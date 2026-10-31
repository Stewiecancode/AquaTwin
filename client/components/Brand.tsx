/** Displays the supplied logo unchanged, with its transparent padding clipped by CSS. */
export function Brand() {
  return (
    <span className="brand-artwork">
      <span className="brand-image-window">
        <img
          src="/brand/aquatwin-logo.png"
          alt="AquaTwin — Smart Water Management"
          width={1772}
          height={886}
        />
      </span>
    </span>
  );
}
