import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import roomsRouter from "./rooms";
import messagesRouter from "./messages";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/rooms", roomsRouter);
router.use("/rooms", messagesRouter);
router.use("/uploads", uploadsRouter);

export default router;
