import { Router } from "express";
import { getDeliveryHealth } from "../Controller/adminController.mjs";
import requireAdmin from "../Middlewares/requireAdmin.mjs";
import { moderationReviewLimiter } from "../Middlewares/rateLimiters.mjs";

const router = Router();

router
  .route("/delivery-health")
  .get(moderationReviewLimiter, requireAdmin, getDeliveryHealth);

export default router;
