// Shimmer placeholders shown while a page's data loads. Lifted from the OVP app.
export function SkeletonLine({ width = '100%', height = 14 }) {
  return <div className="skel" style={{ width, height }} />;
}

export function SkeletonCard() {
  return (
    <div className="skel-card">
      <SkeletonLine width="40%" height={18} />
      <SkeletonLine width="90%" />
      <SkeletonLine width="70%" />
    </div>
  );
}

// Dashboard-shaped loader: a row of stat tiles, then a list.
export default function DashboardSkeleton() {
  return (
    <>
      <div className="head"><SkeletonLine width="220px" height={26} /></div>
      <div className="stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="stat" key={i}>
            <SkeletonLine width="60%" height={11} />
            <div style={{ marginTop: 14 }}><SkeletonLine width="45%" height={28} /></div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '16px 20px', borderTop: i ? '1px solid var(--line)' : 'none', alignItems: 'center' }}>
            <SkeletonLine width="28%" />
            <SkeletonLine width="24%" />
            <SkeletonLine width="12%" />
            <SkeletonLine width="12%" />
          </div>
        ))}
      </div>
    </>
  );
}
