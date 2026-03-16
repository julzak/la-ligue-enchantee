export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.14} viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2,2 L26,2 L26,22 Q14,30 2,22 Z" fill="#1C1C1C" stroke="#C8A84B" strokeWidth="1.2"/>
      <path d="M5,5 L23,5 L23,21 Q14,27 5,21 Z" fill="none" stroke="#C8A84B" strokeWidth="0.4" opacity="0.35"/>
      <polygon points="7,6.5 7.7,9 10.2,9 8.2,10.4 9,12.8 7,11.4 5,12.8 5.8,10.4 3.8,9 6.3,9" fill="#C8A84B"/>
      <polygon points="14,5 14.8,7.8 17.6,7.8 15.4,9.4 16.2,12.2 14,10.6 11.8,12.2 12.6,9.4 10.4,7.8 13.2,7.8" fill="#C8A84B"/>
      <polygon points="21,6.5 21.7,9 24.2,9 22.2,10.4 23,12.8 21,11.4 19,12.8 19.8,10.4 17.8,9 20.3,9" fill="#C8A84B"/>
      <text x="14" y="18" fontFamily="Arial Black,Impact,sans-serif" fontSize="8" fontWeight="900" fill="#C8A84B" textAnchor="middle" dominantBaseline="central">L</text>
    </svg>
  );
}
