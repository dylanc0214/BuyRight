function scoreClass(score) {
  if (score >= 80) return 'score-high';
  if (score >= 65) return 'score-mid';
  return 'score-low';
}

export default function CarCard({ car, onAction }) {
  return (
    <div className="car-card">
      <div className="car-image-wrap">
        {car.imageUrl ? (
          <img className="car-image" src={car.imageUrl} alt={car.title} loading="lazy" />
        ) : (
          <div className="car-image placeholder">🚗</div>
        )}
        <span className={`dealscore ${scoreClass(car.dealscore)}`}>DealScore {car.dealscore}</span>
        {car.belowMarket && <span className="badge-below">Below market</span>}
      </div>

      <div className="car-body">
        <div className="car-title">{car.title}</div>
        <div className="car-price-row">
          <span className="car-price">{car.priceFormatted}</span>
          <span className="car-monthly">≈ {car.monthlyEstimateFormatted}</span>
        </div>
        <div className="car-market">Market: {car.marketValueFormatted}</div>

        <div className="car-chips">
          <span className="chip">{car.year}</span>
          <span className="chip">{car.mileageFormatted}</span>
          <span className="chip">{car.transmission}</span>
          <span className="chip">{car.fuelType}</span>
          <span className="chip">{car.bodyType}</span>
          <span className="chip">📍 {car.city}, {car.state}</span>
        </div>

        {car.aiSummary && <p className="car-summary">{car.aiSummary}</p>}

        {car.seller && (
          <div className="car-seller">
            {car.seller.photoUrl && <img className="seller-photo" src={car.seller.photoUrl} alt={car.seller.name} loading="lazy" />}
            <span>
              {car.seller.dealershipName || car.seller.name}
              {car.seller.verified && <span className="verified" title="Verified seller"> ✓</span>}
              {car.seller.rating != null && <span className="seller-rating"> ★ {car.seller.rating.toFixed(1)}</span>}
            </span>
          </div>
        )}

        {onAction && (
          <div className="car-actions">
            <button className="btn-card" onClick={() => onAction(`Tell me more about the ${car.title}`)}>Details</button>
            <button className="btn-card" onClick={() => onAction(`Compare the ${car.title} with the other results`)}>Compare</button>
          </div>
        )}
      </div>
    </div>
  );
}
