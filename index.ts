import "reflect-metadata";
import express, { NextFunction, Request, Response } from "express";
import URLShortenerManager from "./services/url-shortener.service";
import UserManager from "./services/users.service";

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

app.get("/", (req, res) => {
  res.send("Hello");
});

app.get("/all", async (req, res, next) => {
  try {
    const allData = await URLShortenerManager.getAllUrls();
    res.json(allData);
  } catch (err) {
    next(err);
  }
});

app.get("/users", async (req, res, next) => {
  try {
    const allData = await UserManager.getAllUsers();
    res.json(allData);
  } catch (err) {
    next(err);
  }
});

app.get("/redirect", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const shortcode = req.query.code as string | undefined;
      if (!shortcode) {
        return res
          .status(400)
          .json({ statusCode: 400, error: "Short code is required." });
      }
      let originalUrl = await URLShortenerManager.handleRedirect(shortcode);

      return originalUrl
        ? res.status(302).redirect(originalUrl)
        : res.status(404).json({
            statusCode: 404,
            error: "Short code does not exist.",
          });
    } catch (err) {
      next(err);
    }
  })();
});

app.post("/shorten", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const { long_url }: { long_url: string | null } = req.body
        ? req.body
        : { long_url: null };
      if (!long_url) {
        return res.status(400).json({
          statusCode: 400,
          error: "Original long URL is required!",
        });
      }

      const apiKey = req.headers["api-key"] as string;

      if (apiKey) {
        const userInfo = await UserManager.getUserByApiKey(apiKey);
        if (userInfo) {
          const newShortCode = await URLShortenerManager.createShortCode(
            long_url,
            userInfo
          );
          res.status(201).json({ statusCode: 201, short_code: newShortCode });
        } else {
          res
            .status(400)
            .json({ statusCode: 400, error: "User does not exist." });
        }
      } else {
        res
          .status(400)
          .json({ statusCode: 400, error: "API Key not provided." });
      }
    } catch (err) {
      next(err);
    }
  })();
});

app.delete("/delete", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const { short_code } = req.body ? req.body : { short_code: null };
      if (!short_code) {
        return res
          .status(400)
          .json({ statusCode: 400, error: "Short code is required." });
      }

      const deletedShortCode = await URLShortenerManager.deleteShortCode(
        short_code
      );

      short_code == deletedShortCode
        ? res.status(200).json({
            statusCode: 200,
            message: `${short_code} deleted successfully!`,
          })
        : res.status(404).json({
            statusCode: 404,
            error: "Short code does not exist.",
          });
    } catch (err) {
      next(err);
    }
  })();
});

export default app;
