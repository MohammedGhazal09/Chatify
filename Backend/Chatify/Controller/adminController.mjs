import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";
import {
  buildDeliveryHealthPayload,
  normalizeDeliveryHealthWindow,
} from "../Utils/deliveryHealth.mjs";

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
