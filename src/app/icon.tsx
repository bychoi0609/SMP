import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #dbeafe 0%, #bfdbfe 100%)",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
          }}
        >
          ☀️
        </div>
      </div>
    ),
    { ...size },
  );
}
