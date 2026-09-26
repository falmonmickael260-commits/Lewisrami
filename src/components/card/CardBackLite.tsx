/**
 * Dos de carte léger, dessiné uniquement en dégradés CSS.
 *
 * Utilisé pour les cartes en vol : une distribution met jusqu'à 46 dos à
 * l'écran simultanément, et autant de SVG complets coûterait des images par
 * seconde. Les dégradés restent vectoriels, donc parfaitement nets.
 */
export function CardBackLite({ width }: { width: number }) {
  const unit = Math.max(4, width * 0.13);
  return (
    <div
      className="h-full w-full"
      aria-hidden="true"
      style={{
        borderRadius: 'inherit',
        background: `
          radial-gradient(ellipse at 50% 42%, rgba(233,205,141,0.22), transparent 58%),
          repeating-linear-gradient(45deg, rgba(233,205,141,0.16) 0 1px, transparent 1px ${unit}px),
          repeating-linear-gradient(-45deg, rgba(233,205,141,0.16) 0 1px, transparent 1px ${unit}px),
          linear-gradient(140deg, #123a52, #0c2739 46%, #081a27)
        `,
        boxShadow: `inset 0 0 0 ${Math.max(1, width * 0.035)}px rgba(169,130,47,0.55)`,
      }}
    />
  );
}
