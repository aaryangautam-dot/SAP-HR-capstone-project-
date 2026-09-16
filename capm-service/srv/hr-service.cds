using raven.hr as hr from '../db/schema';

service HRService {
    entity Departments as projection on hr.Departments;
    entity Employees as projection on hr.Employees;
    entity LeaveTypes as projection on hr.LeaveTypes;
    entity LeaveBalances as projection on hr.LeaveBalances;
    entity LeaveRequests as projection on hr.LeaveRequests
    { *, attachments : redirected to LeaveRequestAttachments }
    actions {
        action submit() returns LeaveRequests;
        action cancel() returns LeaveRequests;
    };
    entity LeaveRequestAttachments as projection on hr.LeaveRequestAttachments;
    entity LeaveRequestOverview as projection on hr.LeaveRequestOverview;
    function getLeaveBalance(employeeID: UUID, leaveTypeID: UUID, year: Integer) returns Decimal;
    // called back by the BPA service tasks — see Phase 4
    action approveCallback(requestID: UUID, comment: String) returns String;
    action rejectCallback(requestID: UUID, comment: String) returns String;
}