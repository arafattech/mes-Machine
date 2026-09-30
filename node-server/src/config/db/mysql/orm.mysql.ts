import { request } from "http";
import { createPool, Pool } from "mysql2/promise";

export class MysqlSchema {
  private pool: Pool;

  constructor() {
    this.pool = createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password:process.env.MYSQL_PASSWORD,
      database:process.env.MYSQL_DB_NAME,
      port : Number(process.env.MYSQL_DB_PORT),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async query(sql: string, params: any[] = []) {
    console.log('db affected');
    try {
      const [rows] = await this.pool.execute(sql, params);
      return {
        success: true,
        data: rows,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
