import { motion } from "framer-motion";
import { Link } from "wouter";

interface CarCardProps {
  car: {
    car_id: number;
    brand: string;
    model: string;
    variant_name: string;
    price_lakh: number;
    mileage_kmpl: number;
    fuel_type: string;
    transmission: string;
    body_type: string;
    safety_rating: number;
    sentiment_score: number;
    score?: number;
    image_url?: string;
  };
  index?: number;
  onCompareToggle?: (id: number) => void;
  inCompare?: boolean;
}

export function CarCard({ car, index = 0, onCompareToggle, inCompare }: CarCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="relative group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-colors duration-300"
    >
      <Link href={`/car/${car.car_id}`}>
        <div className="cursor-pointer">
          <div className="relative h-44 bg-gradient-to-br from-[hsl(220,20%,8%)] to-[hsl(220,20%,12%)] overflow-hidden">
            {car.image_url ? (
              <img
                src={car.image_url}
                alt={`${car.brand} ${car.model}`}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <div
              className={`${car.image_url ? "hidden" : ""} absolute inset-0 flex items-center justify-center`}
            >
              <div className="text-4xl font-black text-primary/20 select-none">
                {car.brand.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="absolute top-2 right-2 bg-primary/90 text-white text-xs font-bold px-2 py-0.5 rounded">
              {car.fuel_type}
            </div>
            {car.score != null && (
              <div className="absolute bottom-2 left-2 bg-black/70 text-secondary text-xs font-bold px-2 py-0.5 rounded">
                Score {(car.score * 100).toFixed(0)}
              </div>
            )}
          </div>

          <div className="p-4">
            <div className="mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{car.brand}</span>
              <h3 className="text-base font-bold text-foreground leading-tight">
                {car.model}{" "}
                <span className="text-xs font-normal text-muted-foreground">{car.variant_name}</span>
              </h3>
            </div>

            <div className="text-xl font-black text-primary mb-3">
              ₹{car.price_lakh.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">lakh</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <span className="text-foreground/60">⛽</span>
                <span>{car.mileage_kmpl > 0 ? `${car.mileage_kmpl} km/l` : "Electric"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-foreground/60">⚙</span>
                <span>{car.transmission}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-foreground/60">★</span>
                <span>Safety {car.safety_rating}/5</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-foreground/60">◈</span>
                <span>{car.body_type}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {onCompareToggle && (
        <div className="px-4 pb-4">
          <motion.button
            onClick={(e) => {
              e.preventDefault();
              onCompareToggle(car.car_id);
            }}
            className={`w-full py-1.5 rounded text-xs font-medium border transition-colors ${
              inCompare
                ? "bg-secondary/20 border-secondary/50 text-secondary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {inCompare ? "Remove from Compare" : "+ Add to Compare"}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
