// Full-width banners at the top of the screen: the split alert (stays while split) and
// pull-over alerts (8 s each, see useAlerts).
import type { Alert } from '../firebase/alerts'

export function AlertBanner({ split, alerts }: { split: boolean; alerts: Alert[] }) {
  if (!split && alerts.length === 0) return null
  return (
    <div className="banners" role="alert">
      {split && (
        <div className="banner danger">
          <strong>CONVOY SPLIT — SLOW DOWN AND WAIT</strong>
          <span dir="rtl" lang="he">
            השיירה התפצלה – האט להמתנה
          </span>
        </div>
      )}
      {alerts.map((a) => (
        <div key={a.id} className={`banner pullover car-${a.role}`}>
          <strong>{a.role.toUpperCase()}: PULLING OVER</strong>
        </div>
      ))}
    </div>
  )
}
