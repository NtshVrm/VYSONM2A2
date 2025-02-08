import "reflect-metadata";
import express, { NextFunction, Request, Response } from "express";
import URLShortenerManager from "./services/url-shortener.service";
import UserManager from "./services/users.service";
import { responseJson } from "./utils/response.util";

const app = express();
app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Type", "application/json");
  const apiKey = req.headers["api-key"] as string;

  (async () => {
    if (!apiKey) {
      return res
        .status(403)
        .json({ statusCode: 403, error: "API key is required." });
    }
    const userInfo = await UserManager.getUserByApiKey(apiKey);

    if (!userInfo) {
      return res.status(404).json(responseJson.userNotFound);
    }

    if (req.url == "/shorten-bulk" && userInfo.tier != "enterprise") {
      return res.status(400).json({
        statusCode: 400,
        error: "You do not have access for this operation.",
      });
    }
  })();

  next();
});

app.get("/", (req, res) => {
  res.send("Hello");
});

app.get("/all", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const allData = await URLShortenerManager.getAllUrls();
      return res.json(allData);
    } catch (err) {
      next(err);
    }
  })();
});

app.get("/users", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const allData = await UserManager.getAllUsers();
      return res.json(allData);
    } catch (err) {
      next(err);
    }
  })();
});

app.get("/redirect", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const shortcode = req.query.code as string | undefined;
      if (!shortcode) {
        return res.status(400).json(responseJson.shortCodeRequired);
      }

      const apiKey = req.headers["api-key"] as string;

      let originalUrl = await URLShortenerManager.handleRedirect(
        shortcode,
        apiKey
      );

      return originalUrl
        ? res.status(302).redirect(originalUrl)
        : res.status(404).json(responseJson.shortCodeNotFound);
    } catch (err) {
      next(err);
    }
  })();
});

app.post("/shorten", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const {
        long_url,
        expiry_date,
        custom_code,
      }: {
        long_url: string | null;
        expiry_date: string | null;
        custom_code: string | null;
      } = req.body
        ? req.body
        : { long_url: null, expiry_date: null, custom_code: null };

      const apiKey = req.headers["api-key"] as string;

      if (!long_url) {
        return res.status(400).json({
          statusCode: 400,
          error: "Original long URL is required!",
        });
      }

      if (custom_code != null && custom_code == "") {
        return res.status(400).json({
          statusCode: 400,
          error: "Custom Code cannot be empty!",
        });
      }

      if (custom_code) {
        const exists =
          await URLShortenerManager.checkShortCodeExists(custom_code);
        if (exists) {
          return res.status(400).json({
            statusCode: 400,
            error:
              "Short code already exists, please try with a different code.",
          });
        }
      }
      const newShortCode = await URLShortenerManager.createShortCode(
        {
          long_url: long_url,
          expiry_date: expiry_date,
          custom_code: custom_code,
        },
        apiKey
      );
      return res.status(201).json({
        statusCode: 201,
        short_code: newShortCode,
        expiry_date: expiry_date || null,
      });
    } catch (err) {
      next(err);
    }
  })();
});

app.put(
  "/code/:shortCode",
  (req: Request, res: Response, next: NextFunction) => {
    (async () => {
      const shortCode = req.params.shortCode;
      const {
        expiry_date,
      }: {
        expiry_date: string | null;
      } = req.body ? req.body : { expiry_date: null };

      if (!shortCode) {
        return res.status(400).json(responseJson.shortCodeRequired);
      }

      const apiKey = req.headers["api-key"] as string;

      const row = await URLShortenerManager.findOneRow(shortCode, apiKey);

      if (row) {
        const updatedData = await URLShortenerManager.createShortCode(
          {
            long_url: row?.original_url,
            custom_code: row?.short_code,
            expiry_date: expiry_date,
          },
          apiKey
        );

        return res
          .status(201)
          .json({ statusCode: 200, short_code: updatedData });
      } else {
        return res.status(400).json(responseJson.shortCodeNotFound);
      }
    })();
  }
);

app.post("/shorten-bulk", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const {
        long_urls,
      }: {
        long_urls: string[] | [];
      } = req.body ? req.body : { long_urls: [] };

      const apiKey = req.headers["api-key"] as string;

      let batch: { original_url: string; short_code: string | null }[] = [];

      if (!long_urls || long_urls.length == 0) {
        return res.status(400).json({
          statusCode: 400,
          error: "Original long URL's are required!",
        });
      }

      batch = await Promise.all(
        long_urls.map(async (long_url) => {
          const newShortCode = await URLShortenerManager.createShortCode(
            {
              long_url,
              expiry_date: null,
              custom_code: null,
            },
            apiKey
          );
          return { original_url: long_url, short_code: newShortCode };
        })
      );

      return res.status(201).json({ statusCode: 201, batch });
    } catch (err) {}
  })();
});

app.delete("/delete", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const { short_code } = req.body ? req.body : { short_code: null };
      if (!short_code) {
        return res.status(400).json(responseJson.shortCodeRequired);
      }

      const apiKey = req.headers["api-key"] as string;

      const deletedShortCode = await URLShortenerManager.deleteShortCode(
        short_code,
        apiKey
      );

      return short_code == deletedShortCode
        ? res.status(200).json({
            statusCode: 200,
            message: `${short_code} deleted successfully!`,
          })
        : res.status(404).json(responseJson.shortCodeNotFound);
    } catch (err) {
      next(err);
    }
  })();
});

export default app;
