import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";
import {
  buildDeliveryHealthPayload,
  normalizeDeliveryHealthWindow,
} from "../Utils/deliveryHealth.mjs";
import { buildPrivacyOperationsPayload } from "../Services/privacyOperationsService.mjs";
import { buildIntegrationDiagnosticsPayload } from "./integrationController.mjs";

export const getDeliveryHealth = asyncErrHandler(async (req, res, next) => {
  const normalizedWindow = normalizeDeliveryHealthWindow(req.query?.window);

  if (!normalizedWindow.ok) {
    return next(new CustomError(normalizedWindow.message, normalizedWindow.statusCode));
  }

  const deliveryHealth = await buildDeliveryHealthPayload({
    windowKey: normalizedWindow.windowKey,
  });

  res.status(200).json({
    status: "success",
    data: {
      deliveryHealth,
    },
  });
});

export const getPrivacyOperations = asyncErrHandler(async (req, res) => {
  const privacyOperations = await buildPrivacyOperationsPayload();

  res.status(200).json({
    status: "success",
    data: {
      privacyOperations,
    },
  });
});

export const getIntegrationDiagnostics = asyncErrHandler(async (req, res) => {
  const integrations = await buildIntegrationDiagnosticsPayload();

  res.status(200).json({
    status: "success",
    data: {
      integrations,
    },
  });
});
