import { DataSource } from "typeorm";
import { URLShortener } from "../models/url-shortener.model";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "ep-blue-band-a191g35o-pooler.ap-southeast-1.aws.neon.tech",
  username: "neondb_owner",
  password: "npg_UtVOWoM4Qs1P",
  database: "neondb",
  synchronize: true,
//   logging: true,
  entities: [URLShortener],
  subscribers: [],
  migrations: [],
  ssl: {
    rejectUnauthorized: false,
  },
});
