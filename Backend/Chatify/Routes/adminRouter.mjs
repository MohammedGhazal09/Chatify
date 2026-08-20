import { Router } from "express";
import { getDeliveryHealth, getIntegrationDiagnostics, getPrivacyOperations } from "../Controller/adminController.mjs";
import requireAdmin from "../Middlewares/requireAdmin.mjs";
import { moderationReviewLimiter } from "../Middlewares/rateLimiters.mjs";

const router = Router();

router
  .route("/delivery-health")
  .get(moderationReviewLimiter, requireAdmin, getDeliveryHealth);

router
  .route("/privacy-operations")
  .get(moderationReviewLimiter, requireAdmin, getPrivacyOperations);

router
  .route("/integrations")
  .get(moderationReviewLimiter, requireAdmin, getIntegrationDiagnostics);

export default router;
