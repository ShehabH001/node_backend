
import { Router } from "express";
import { getAllSubscriptions, getSubscriptionBooks } from "../controllers/subscriptionController.mjs";
const router = Router();

router.get("", getAllSubscriptions); // Get all tags
router.get("/:id/books", getSubscriptionBooks); // Get books by tag ID

export default router;