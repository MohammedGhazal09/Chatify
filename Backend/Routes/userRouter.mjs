import { Router } from "express";
import { getLoggedUser, getAllUsers } from "../Controller/userController.mjs";
import protect from "../Middlewares/protectRoutes.mjs";

const router = Router();

router.route('/get-logged-user').get(protect, getLoggedUser)
router.route('/get-all-users').get(protect, getAllUsers)

export default router;