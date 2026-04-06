import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import carsRouter from "./cars";
import recommendRouter from "./recommend";
import compareRouter from "./compare";
import queryRouter from "./query";
import imagesRouter from "./images";
import insightsRouter from "./insights";
import newsRouter from "./news";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(carsRouter);
router.use(recommendRouter);
router.use(compareRouter);
router.use(queryRouter);
router.use(imagesRouter);
router.use(insightsRouter);
router.use(newsRouter);

export default router;
