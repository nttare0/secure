import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import roomsRouter from "./rooms";
import messagesRouter from "./messages";
import uploadsRouter from "./uploads";
import dmsRouter from "./dms";
import adminRouter from "./admin";
import forwardRouter from "./forward";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/rooms", roomsRouter);
router.use("/rooms", messagesRouter);
router.use("/dms", dmsRouter);
router.use("/uploads", uploadsRouter);
router.use("/admin", adminRouter);
router.use("/messages", forwardRouter);

export default router;
