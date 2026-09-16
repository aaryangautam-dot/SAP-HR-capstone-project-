const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    const { LeaveRequests, LeaveBalances, Employees } = this.entities;

    function businessDays(from, to) {
        const days = (new Date(to) - new Date(from)) / 86400000 + 1;
        return Math.max(days, 0);
    }

    this.before('CREATE', LeaveRequests, async (req) => {
        const { fromDate, toDate, employee_ID, leaveType_ID } = req.data;
        if (new Date(fromDate) > new Date(toDate)) {
            return req.error(400, 'fromDate must be on or before toDate');
        }
        req.data.numberOfDays = businessDays(fromDate, toDate);
        req.data.status = 'Draft';
        const bal = await SELECT.one.from(LeaveBalances)
            .where({ employee_ID, leaveType_ID, year: new Date(fromDate).getFullYear() });
        if (!bal || (Number(bal.entitlement) - Number(bal.used)) < req.data.numberOfDays) {
            return req.error(422, 'Insufficient leave balance for the selected dates');
        }
    });

    this.on('submit', LeaveRequests, async (req) => {
        const id = req.params?.[0]?.ID ?? (typeof req.params?.[0] === 'string' ? req.params[0] : null) ?? req.data?.ID ?? req.data?.id;
        const lr = await SELECT.one.from(LeaveRequests).where({ ID: id });
        if (!lr) return req.error(404, 'Leave request not found');
        if (lr.status !== 'Draft') return req.error(409, 'Only Draft requests can be submitted');

        // generate a human-readable request number from the HDB sequence
        let requestNumber;
        try {
            const seqResult = await cds.db.run(
                `SELECT "leaveRequestNumber".NEXTVAL AS NUM FROM DUMMY`
            );
            requestNumber = 'LR-' + String(seqResult[0].NUM).padStart(6, '0');
        } catch (err) {
            // fallback when testing without HANA or sequence
            const count = await SELECT.from(LeaveRequests).columns('count(1) as total');
            const nextNum = (count[0]?.total || 0) + 1;
            requestNumber = 'LR-' + String(nextNum).padStart(6, '0');
        }

        // Enrich workflow context with employee, manager, department, and leave type details
        const emp = await SELECT.one.from(Employees).where({ ID: lr.employee_ID });
        let deptName = '';
        if (emp?.department_ID) {
            const dept = await SELECT.one.from('raven.hr.Departments').where({ ID: emp.department_ID });
            deptName = dept?.name || '';
        }
        let managerName = '';
        let managerEmail = '';
        if (emp?.manager_ID) {
            const mgr = await SELECT.one.from(Employees).where({ ID: emp.manager_ID });
            managerName = `${mgr?.firstName || ''} ${mgr?.lastName || ''}`.trim();
            managerEmail = mgr?.email || '';
        }
        const lt = await SELECT.one.from('raven.hr.LeaveTypes').where({ ID: lr.leaveType_ID });

        // Start the BPA workflow instance
        let workflowInstanceId = null;
        const workflowPayload = {
            definitionId: 'raven.hr.leaveApproval',
            context: {
                requestID: id,
                requestNumber,
                employeeID: lr.employee_ID,
                employeeCode: emp?.employeeCode || '',
                employeeName: `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim(),
                employeeEmail: emp?.email || '',
                managerID: emp?.manager_ID || '',
                managerName,
                managerEmail,
                departmentName: deptName,
                leaveType: lt?.name || '',
                fromDate: lr.fromDate,
                toDate: lr.toDate,
                numberOfDays: Number(lr.numberOfDays),
                reason: lr.reason || ''
            }
        };

        try {
            const workflow = await cds.connect.to('WORKFLOW');
            const instance = await workflow.send('POST', '/workflow-instances', workflowPayload);
            workflowInstanceId = instance?.id;
            console.log(`[BPA Workflow] Successfully started workflow instance ${workflowInstanceId} for request ${requestNumber}`);
        } catch (e) {
            console.log('[BPA Workflow] WORKFLOW destination not configured or offline, continuing with local simulation state:', e.message);
        }

        await UPDATE(LeaveRequests).set({
            status: 'Submitted',
            requestNumber,
            workflowInstanceId: workflowInstanceId || ('WF-' + Date.now()),
        }).where({ ID: id });

        return await SELECT.one.from(LeaveRequests).where({ ID: id });
    });

    this.on('cancel', LeaveRequests, async (req) => {
        const id = req.params?.[0]?.ID ?? (typeof req.params?.[0] === 'string' ? req.params[0] : null) ?? req.data?.ID ?? req.data?.id;
        const lr = await SELECT.one.from(LeaveRequests).where({ ID: id });
        if (!lr) return req.error(404, 'Leave request not found');
        if (!['Draft', 'Submitted'].includes(lr.status)) {
            return req.error(409, 'Only Draft or Submitted requests can be cancelled');
        }
        await UPDATE(LeaveRequests).set({ status: 'Cancelled' }).where({ ID: id });
        return await SELECT.one.from(LeaveRequests).where({ ID: id });
    });

    this.on('getLeaveBalance', async (req) => {
        const { employeeID, leaveTypeID, year } = req.data;
        const bal = await SELECT.one.from(LeaveBalances)
            .where({ employee_ID: employeeID, leaveType_ID: leaveTypeID, year });
        return bal ? (Number(bal.entitlement) - Number(bal.used)) : 0;
    });

    this.on('approveCallback', async (req) => {
        const { requestID, comment } = req.data;
        const lr = await SELECT.one.from(LeaveRequests).where({ ID: requestID });
        if (!lr) return req.error(404, 'Leave request not found');
        if (lr.status !== 'Submitted') {
            return req.error(409, `Leave request is currently in status '${lr.status}', only 'Submitted' requests can be approved`);
        }

        let newBalance = null;
        try {
            const result = await cds.db.run(
                `CALL "RECALC_LEAVE_BALANCE"(?, ?, ?, ?, ?)`,
                [lr.employee_ID, lr.leaveType_ID, new Date(lr.fromDate).getFullYear(), lr.numberOfDays, null]
            );
            newBalance = result[0]?.NEWBALANCE;
        } catch (e) {
            // fallback calculation on SQLite / local runtime
            const year = new Date(lr.fromDate).getFullYear();
            const bal = await SELECT.one.from(LeaveBalances)
                .where({ employee_ID: lr.employee_ID, leaveType_ID: lr.leaveType_ID, year });
            if (bal) {
                const used = Number(bal.used || 0) + Number(lr.numberOfDays);
                const updatedBalance = Number(bal.entitlement || 0) - used;
                await UPDATE(LeaveBalances).set({ used, balance: updatedBalance })
                    .where({ ID: bal.ID });
                newBalance = updatedBalance;
            }
        }

        const managerComment = comment || 'Approved by manager';
        await UPDATE(LeaveRequests).set({ status: 'Approved', managerComment }).where({ ID: requestID });
        console.log(`[BPA Workflow Callback] Approved request ${lr.requestNumber || requestID}. Comment: ${managerComment}`);
        return `Approved. New balance: ${newBalance}`;
    });

    this.on('rejectCallback', async (req) => {
        const { requestID, comment } = req.data;
        const lr = await SELECT.one.from(LeaveRequests).where({ ID: requestID });
        if (!lr) return req.error(404, 'Leave request not found');
        if (lr.status !== 'Submitted') {
            return req.error(409, `Leave request is currently in status '${lr.status}', only 'Submitted' requests can be rejected`);
        }

        const managerComment = comment || 'Rejected by manager';
        await UPDATE(LeaveRequests).set({ status: 'Rejected', managerComment }).where({ ID: requestID });
        console.log(`[BPA Workflow Callback] Rejected request ${lr.requestNumber || requestID}. Comment: ${managerComment}`);
        return 'Rejected';
    });
});