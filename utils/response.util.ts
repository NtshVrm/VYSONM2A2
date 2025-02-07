export const responseJson = {
  userNotFound: { statusCode: 400, error: "User does not exist." },
  shortCodeRequired: { statusCode: 400, error: "Short code is required." },
  shortCodeNotFound: {
    statusCode: 404,
    error: "Short code does not exist.",
  },
};
