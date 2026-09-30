export interface HolidayType {
  id: number;
  name: string;
  color: string;
  is_active?: boolean;
}

export interface Holidays {
  id?: number;
  start_date: string;
  end_date?: string;
  type_id: number;
  leave_type_id?: number;
  type: string;
}
