export type PayType = 'Monthly' | 'Hourly'
export type ShiftStatus = 'Planned' | 'Completed' | 'Absent' | 'Leave'
export type PayrollStatus = 'Draft' | 'Approved' | 'Paid'
export type TransactionType = 'Income' | 'Expense'

export interface Employee {
  id: string
  employeeNumber: string | null
  firstName: string
  lastName: string
  nationalId: string | null
  position: string | null
  phone: string | null
  hireDate: string
  terminationDate: string | null
  isActive: boolean
  payType: PayType
  baseSalary: number
  hourlyRate: number | null
  overtimeMultiplier: number
  monthlyStandardHours: number
}

export interface ShiftTemplate {
  id: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
  color: string | null
}

export interface ShiftAssignment {
  id: string
  employeeId: string
  shiftTemplateId: string
  date: string
  status: ShiftStatus
  note: string | null
  workedHours: number | null
  overtimeHours: number | null
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  date: string
  description: string
  documentNo: string | null
  categoryId: string | null
  category: string | null
  isPayroll: boolean
}

export interface Category {
  id: string
  name: string
  type: TransactionType
}

export interface TimeEntry {
  id: string
  employeeId: string
  employeeName: string
  employeeNumber: string | null
  date: string
  clockIn: string
  clockOut: string | null
  breakMinutes: number
  workedHours: number
  overtimeHours: number
  shiftName: string | null
  note: string | null
  locked: boolean
}

export interface BulkResult {
  affected: number
  message: string
}

export interface Payroll {
  id: string
  employeeId: string
  employeeName: string
  position: string | null
  nationalId: string | null
  employeeNumber: string | null
  year: number
  month: number
  workedDays: number
  regularHours: number
  overtimeHours: number
  basePay: number
  overtimePay: number
  bonus: number
  sgkEmployee: number
  unemploymentEmployee: number
  incomeTax: number
  incomeTaxExemption: number
  stampTax: number
  stampTaxExemption: number
  deductions: number
  grossPay: number
  netPay: number
  employerSgk: number
  employerUnemployment: number
  employerCost: number
  status: PayrollStatus
  paidAt: string | null
}

export interface Dashboard {
  year: number
  month: number
  monthIncome: number
  monthExpense: number
  activeEmployees: number
  todayShiftCount: number
  monthOvertimeHours: number
  pendingPayrollTotal: number
  months: { year: number; month: number; income: number; expense: number }[]
  topExpenses: { category: string; total: number }[]
  recent: Transaction[]
}
