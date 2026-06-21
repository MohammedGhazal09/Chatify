import { Router } from "express";
import {
  assignAbuseReport,
  createAbuseReport,
  getAbuseReport,
  getModerationOpsSummary,
  getUserEnforcementHistory,
  listMyModerationEnforcements,
  listAbuseReports,
  reviewAbuseReport,
  reviewModerationAppeal,
  submitModerationAppeal,
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
  .route("/my-enforcements")
  .get(moderationReviewLimiter, listMyModerationEnforcements);

router
  .route("/ops-summary")
  .get(moderationReviewLimiter, requireAdmin, getModerationOpsSummary);

router
  .route("/users/:userId/enforcement-history")
  .get(moderationReviewLimiter, requireAdmin, getUserEnforcementHistory);

router
  .route("/reports/:reportId")
  .get(moderationReviewLimiter, requireAdmin, getAbuseReport);

router
  .route("/reports/:reportId/assign")
  .patch(moderationReviewLimiter, requireAdmin, assignAbuseReport);

router
  .route("/reports/:reportId/appeal")
  .post(moderationReviewLimiter, submitModerationAppeal);

router
  .route("/reports/:reportId/appeals/:appealId")
  .patch(moderationReviewLimiter, requireAdmin, reviewModerationAppeal);

router
  .route("/reports/:reportId/review")
  .patch(moderationReviewLimiter, requireAdmin, reviewAbuseReport);

export default router;
