import { Router, type IRouter } from "express";
import { db, carImagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetCarImageParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/images/:carId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.carId) ? req.params.carId[0] : req.params.carId;
  const parsed = GetCarImageParams.safeParse({ carId: parseInt(rawId, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid car ID" });
    return;
  }

  const { carId } = parsed.data;

  try {
    const [image] = await db.select().from(carImagesTable).where(eq(carImagesTable.carId, String(carId)));
    if (image) {
      res.json({ car_id: carId, image_url: image.imageUrl, fallback: false });
      return;
    }
  } catch {
    // DB not available or no image found, use fallback
  }

  res.json({
    car_id: carId,
    image_url: `https://via.placeholder.com/400x250/1a1a2e/00d4ff?text=Car+${carId}`,
    fallback: true,
  });
});

export default router;
