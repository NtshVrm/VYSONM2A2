import { AppDataSource } from "../db/db.datasource";
import { URLShortener } from "../models/url-shortener.model";

class URLShortenerService {
  private repository;
  private shortCodeLength = 6;
  private characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  constructor() {
    this.repository = AppDataSource.getRepository(URLShortener);
  }

  async connectDB() {
    try {
      if (!AppDataSource.isInitialized) {
        console.log("connecting to DB....");
        await AppDataSource.initialize();
      }
      console.log("DB Connected!");
      return AppDataSource;
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

  async createShortCode(long_url: string): Promise<string | null> {
    try {
      await this.connectDB();
      const new_short_code = await this.generateUniqueShortCode();

      const newUrl = this.repository.create({
        original_url: long_url,
        short_code: new_short_code,
      });

      await this.repository.save(newUrl);
      return new_short_code;
    } catch (err) {
      throw new Error(`Error creating short code: ${(err as Error).message}`);
    }
  }

  async findOneRow(short_code: string) {
    try {
      await this.connectDB();
      const row = await this.repository.findOne({
        where: {
          short_code: short_code,
        },
      });

      return row ? row : null;
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

  async handleRedirect(short_code: string) {
    try {
      const row = await this.findOneRow(short_code);

      if (row?.original_url) {
        const res = await this.repository.update(row.id, {
          visit_count: row.visit_count + 1,
          last_accessed_at: new Date(),
        });

        if (res.affected && res.affected > 0) {
          return row.original_url;
        }
      } else {
        return null;
      }
    } catch (err) {}
  }

  async deleteShortCode(short_code: string) {
    try {
      await this.connectDB();
      const result = await this.repository.delete({ short_code });

      // result.affected tells us how many rows were deleted
      return result.affected === 0 ? null : short_code;
    } catch (err) {
      throw new Error(`Error deleting short code: ${(err as Error).message}`);
    }
  }
}

const URLShortenerManager = new URLShortenerService();
export default URLShortenerManager;
