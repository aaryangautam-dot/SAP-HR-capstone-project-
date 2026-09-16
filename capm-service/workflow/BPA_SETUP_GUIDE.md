# SAP Build Process Automation (BPA) Setup & Integration Guide

This guide details how to integrate and configure the **Leave Request Approval Workflow (`raven.hr.leaveApproval`)** with SAP Build Process Automation (BPA) and SAP Cloud Application Programming Model (CAP).

---

## Architecture Overview

```
 [Employee / UI5] ──> Submit Leave Request ──> [CAP Service: hr-service]
                                                        │
                                                        ▼ POST /workflow-instances
                                              [SAP Build Process Automation]
                                                        │
                                                        ▼ Manager Task (Inbox)
                                                [Manager Approval Form]
                                                   ├── Approve ──> [BPA Action: approveLeaveRequest] ──┐
                                                   └── Reject  ──> [BPA Action: rejectLeaveRequest]  ──┤
                                                                                                        │
                                                                                                        ▼
                                                                     [CAP Callback Endpoints]
                                                                     - /odata/v4/hr/approveCallback
                                                                     - /odata/v4/hr/rejectCallback
```

---

## Step 1: Configure BTP Destinations

In the **SAP BTP Cockpit** (Subaccount $\rightarrow$ **Connectivity** $\rightarrow$ **Destinations**):

### 1. Destination for CAP Backend: `capm-service`
Used by SAP Build Process Automation to call back the CAP service actions.
- **Name**: `capm-service`
- **Type**: `HTTP`
- **URL**: `https://<your-subdomain>-dev-capm-service-srv.cfapps.<region>.hana.ondemand.com`
- **Proxy Type**: `Internet`
- **Authentication**: `OAuth2JWTBearer` or `OAuth2UserTokenExchange` (or `NoAuthentication` with `HTML5.ForwardAuthToken=true` via Approuter)
- **Additional Properties**:
  - `HTML5.DynamicDestination`: `true`
  - `WebIDEEnabled`: `true`

### 2. Destination for BPA Workflow: `spa_workflow_service`
Used by the CAP backend to start workflow instances.
- Created automatically when binding the `process-automation-service` or `workflow` service instance to the CAP service in `mta.yaml`.
- For manual destination:
  - **Name**: `spa_workflow_service`
  - **Type**: `HTTP`
  - **URL**: `https://spa-api-gateway-bpi-us-prod.cfapps.<region>.hana.ondemand.com/workflow/rest/v1` (or your BPA tenant API URL)
  - **Authentication**: `OAuth2ClientCredentials`
  - **Client ID / Secret / Token Service URL**: From your BPA service key.

---

## Step 2: Import BPA Actions in SAP Build Process Automation

1. Open **SAP Build Process Automation** lobby.
2. Click **Create** $\rightarrow$ **Build an Automated Process** $\rightarrow$ **Action**.
3. Name the Action Project: `HR Leave Management Callbacks`.
4. Select **Upload an API Specification** and choose:
   `capm-service/workflow/bpa-actions-openapi.json`
5. Select destination `capm-service`.
6. Review the two imported actions:
   - **`approveLeaveRequest`**: POST `/odata/v4/hr/approveCallback`
   - **`rejectLeaveRequest`**: POST `/odata/v4/hr/rejectCallback`
7. Click **Publish** to release the Actions project to the library.

---

## Step 3: Create the Business Process (`raven.hr.leaveApproval`)

1. In the SAP Build Process Automation lobby, create a **Business Process Project** named `Leave Approval Process`.
2. Create a **Process** with ID `raven.hr.leaveApproval`.
3. Add an **API Trigger**:
   - Inputs match `workflow/process-definition.json`:
     - `requestID` (String)
     - `requestNumber` (String)
     - `employeeName` (String)
     - `employeeEmail` (String)
     - `managerEmail` (String)
     - `departmentName` (String)
     - `leaveType` (String)
     - `fromDate` (Date)
     - `toDate` (Date)
     - `numberOfDays` (Number)
     - `reason` (String)
4. Add a **Form / User Task**:
   - Title: `Leave Request Approval`
   - Use layout from `workflow/approval-form.json`.
   - Set Recipient to Process Trigger `managerEmail`.
5. Add an **Exclusive Gateway (Condition)**:
   - Branch 1: If Form Outcome equals `Approve`
     - Add Action step: `HR Leave Management Callbacks` $\rightarrow$ `approveLeaveRequest`.
     - Map input `requestID` $\leftarrow$ `Trigger.requestID`, `comment` $\leftarrow$ `Form.decisionComment`.
   - Branch 2: If Form Outcome equals `Reject`
     - Add Action step: `HR Leave Management Callbacks` $\rightarrow$ `rejectLeaveRequest`.
     - Map input `requestID` $\leftarrow$ `Trigger.requestID`, `comment` $\leftarrow$ `Form.decisionComment`.
6. (Optional) Add a **Mail Task** to notify `Trigger.employeeEmail` of the decision.
7. Click **Release** and **Deploy** the process.

---

## Step 4: Local Simulation vs Production Runtime

- **Local Mode (`cds watch`)**:
  When `WORKFLOW` destination is not bound, CAP automatically detects offline/local mode, generates a simulation ID (`WF-<timestamp>`), and logs all payload context to the console.
- **Production Mode (BTP)**:
  When deployed via MTA, CAP connects to `WORKFLOW` via the service binding or BTP destination, starts the real BPA workflow instance, and stores the actual SAP BPA instance GUID in `workflowInstanceId`.

---

## Step 5: Testing End-to-End

1. Open the UI5 Self-Service App: `http://localhost:4004/webapp/index.html` (or deployed Approuter).
2. Click **Create Leave Request**, select dates and leave type, then click **Submit Request**.
3. Check the console log or BPA monitoring app:
   - The workflow instance is created.
   - The request status updates to `Submitted`.
4. As Manager, open **SAP Build My Inbox** (or HR Admin Pending Approvals tab).
5. Click **Approve** or **Reject** with a comment.
6. Refresh the request in Self-Service:
   - Status changes to `Approved` or `Rejected`.
   - Leave balance is automatically recalculated.
   - Manager comment is saved.
