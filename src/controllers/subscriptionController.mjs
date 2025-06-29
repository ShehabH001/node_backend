import Subscription from "../models/Subscription.mjs";

/**
 * Get all subscription with pagination or by a list of tag IDs.
 */
export const getAllSubscriptions = async (req, res) => {
  try {
    console.log("Fetching all subscriptions");
    const subscriptions = await Subscription.getAllSubscriptions();
    console.log("Subscriptions:", subscriptions);
    return res.status(200).json(subscriptions);
  } catch (err) {
    return res.status(500).json({ message: "Error getting subscriptions", error: err.message });
  }
};

/**
 * Get books by subscription ID with pagination.
 */
export const getSubscriptionBooks = async (req, res) => {
  try {
    const { id: subscription_id } = req.params;
    const { limit, offset } = req.query;
    if (!limit || !offset) {
      return res.status(400).json({ message: "Limit and offset are required" });
    }
    if (!subscription_id) {
      return res.status(400).json({ message: "Subscription ID is required" });
    }
    const books = await Subscription.getSubscriptionBooks(subscription_id, limit, offset);
    return res.status(200).json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
