import { Router } from "express";
import { getLoggedUser, getAllUsers } from "../Controller/userController.mjs";

const router = Router();

router.route('/get-logged-user').get(getLoggedUser)
router.route('/get-all-users').get(getAllUsers)

export default router;