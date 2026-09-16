namespace raven.hr;

entity Departments {
    key ID : UUID;
    name : String(40) @mandatory;
    costCenter : String(10);
}

entity Employees {
    key ID : UUID;
    employeeCode : String(10) @mandatory;
    firstName : String(40) @mandatory;
    lastName : String(40) @mandatory;
    email : String(100) @mandatory;
    department : Association to Departments @mandatory;
    manager : Association to Employees; // self-association
    dateOfJoining : Date;
    status : String(20) default 'Active';
    balances : Composition of many LeaveBalances on balances.employee = $self;
}

entity LeaveTypes {
    key ID : UUID;
    code : String(10) @mandatory;
    name : String(40) @mandatory;
    annualQuota : Integer @mandatory;
}

entity LeaveBalances {
    key ID : UUID;
    employee : Association to Employees;
    leaveType : Association to LeaveTypes @mandatory;
    year : Integer @mandatory;
    entitlement : Decimal(5,1) @mandatory;
    used : Decimal(5,1) default 0;
    balance : Decimal(5,1) @readonly;
}

entity LeaveRequests {
    key ID : UUID;
    requestNumber : String(12) @readonly; // from HDB sequence, e.g. 'LR-000123'
    employee : Association to Employees @mandatory;
    leaveType : Association to LeaveTypes @mandatory;
    fromDate : Date @mandatory;
    toDate : Date @mandatory;
    numberOfDays : Decimal(4,1) @readonly;
    reason : String(200);
    status : String(20) default 'Draft'; // Draft/Submitted/Approved/Rejected/Cancelled
    managerComment : String(200);
    workflowInstanceId : String(80);
    attachments : Composition of many LeaveRequestAttachments on attachments.request = $self;
}

entity LeaveRequestAttachments {
    key ID : UUID;
    request : Association to LeaveRequests;
    fileName : String(100);
    mediaType : String(60);
    content : LargeBinary @Core.MediaType: mediaType @Core.ContentDisposition.Filename: fileName;
    uploadedAt : Timestamp @cds.on.insert: $now;
}

@readonly
entity LeaveRequestOverview as select from LeaveRequests as lr
inner join Employees as e on lr.employee.ID = e.ID
inner join Departments as d on e.department.ID = d.ID
inner join LeaveTypes as lt on lr.leaveType.ID = lt.ID
{
    key lr.ID, lr.requestNumber, lr.fromDate, lr.toDate, lr.numberOfDays, lr.status,
    e.ID as employeeID, e.firstName, e.lastName,
    d.name as departmentName,
    lt.name as leaveTypeName
};