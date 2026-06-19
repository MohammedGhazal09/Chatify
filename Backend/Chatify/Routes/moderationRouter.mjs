import { Router } from "express";
import {
  createAbuseReport,
  listAbuseReports,
  reviewAbuseReport,
} from "../Controller/moderationController.mjs";
import requireAdmin from "../Middlewares/requireAdmin.mjs";
import {
  abuseReportLimiter,
  moderationReviewLimiter,
} from "../Middlewares/rateLimiters.mjs";

const router = Router();

router
  .route("/reports")
  .post(abuseReportLimiter, createAbuseReport)
  .get(moderationReviewLimiter, requireAdmin, listAbuseReports);

router
  .route("/reports/:reportId/review")
  .patch(moderationReviewLimiter, requireAdmin, reviewAbuseReport);

export default router;
