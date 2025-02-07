import { AppDataSource } from "../db/db.datasource";
import { URLShortener } from "../models/url-shortener.model";
import { Users } from "../models/users.model";
import UserManager from "./users.service";

class URLShortenerService {
  private repository;
  private dataSource;
  private shortCodeLength = 6;
  private characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  constructor() {
    this.dataSource = AppDataSource;
    this.repository = this.dataSource.getRepository(URLShortener);
  }

  async connectDB() {
    try {
      if (!this.dataSource.isInitialized) {
        console.log("connecting to DB....");
        await this.dataSource.initialize();
      }
      console.log("DB Connected!");
      return this.dataSource;
    } catch (err) {
      console.log("Error connecting to DB", err);
    }
  }

  generateRandomShortCode() {
    return Array.from(
      { length: this.shortCodeLength },
      () => this.characters[Math.floor(Math.random() * this.characters.length)]
    ).join("");
  }

  async getAllUrls(): Promise<URLShortener[]> {
    try {
      await this.connectDB();

      const urls = await this.repository.find();
      return urls;
    } catch (err) {
      throw new Error(`Error fetching URL's: ${(err as Error).message}`);
    }
  }

  async checkUrlExists(
    long_url: string
  ): Promise<{ short_code: string | null }> {
    try {
      await this.connectDB();
      const existingUrl = await this.repository.findOne({
        where: {
          original_url: long_url,
        },
        select: {
          short_code: true,
        },
      });

      return {
        short_code: existingUrl ? existingUrl.short_code : null,
      };
    } catch (err) {
      throw new Error(
        `Error checking URL existence: ${(err as Error).message}`
      );
    }
  }

  async generateUniqueShortCode(): Promise<string> {
    let shortcode: string = "";
    let exists = true;

    while (exists) {
      shortcode = this.generateRandomShortCode();
      try {
        await this.connectDB();

        const existingCode = await this.repository.findOne({
          where: {
            short_code: shortcode,
          },
          select: {
            short_code: true,
          },
        });

        exists = !!existingCode;
      } catch (err) {
        throw new Error(
          `Error generating unique short code: ${(err as Error).message}`
        );
      }
    }

    return shortcode;
  }

  async createShortCode(
    long_url: string,
    api_key: string
  ): Promise<string | null> {
    try {
      await this.connectDB();
      const new_short_code = await this.generateUniqueShortCode();

      const userInfo = (await UserManager.getUserByApiKey(api_key)) as Users;

      const newUrl = this.repository.create({
        original_url: long_url,
        short_code: new_short_code,
        user: userInfo,
      });

      await this.repository.save(newUrl);
      return new_short_code;
    } catch (err) {
      throw new Error(`Error creating short code: ${(err as Error).message}`);
    }
  }

  async findOneRow(short_code: string, api_key: string) {
    try {
      await this.connectDB();

      const row = await this.repository.findOne({
        where: {
          short_code: short_code,
          user: { api_key: api_key },
        },
        relations: ["user"],
      });

      if (!row || row.deleted_at != null || row.expiry_date < new Date()) {
        return null;
      }

      return row;
    } catch (err) {
      throw new Error(`Error fetching find by one: ${(err as Error).message}`);
    }
  }

  async getOriginalURL(short_code: string): Promise<string | null> {
    try {
      await this.connectDB();
      const url = await this.repository.findOne({
        where: {
          short_code: short_code,
        },
        select: {
          original_url: true,
        },
      });

      return url ? url.original_url : null;
    } catch (err) {
      throw new Error(`Error fetching original URL: ${(err as Error).message}`);
    }
  }

  async handleRedirect(short_code: string, api_key: string) {
    try {
      const row = await this.findOneRow(short_code, api_key);

      if (!row || row.deleted_at) {
        return null;
      }

      const res = await this.repository.update(row.id, {
        visit_count: row.visit_count + 1,
        last_accessed_at: new Date(),
      });

      return res.affected && res.affected > 0 ? row.original_url : null;
    } catch (err) {
      throw new Error(`Error redirecting: ${(err as Error).message}`);
    }
  }

  async deleteShortCode(short_code: string, api_key: string) {
    try {
      await this.connectDB();

      const row = await this.findOneRow(short_code, api_key);
      if (!row) {
        return null;
      }

      const res = await this.repository.update(row.id, {
        deleted_at: new Date(),
      });

      return res.affected && res.affected > 0 ? row.short_code : null;
    } catch (err) {
      throw new Error(`Error deleting short code: ${(err as Error).message}`);
    }
  }
}

const URLShortenerManager = new URLShortenerService();
export default URLShortenerManager;
