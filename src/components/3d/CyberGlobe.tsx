import Spline from '@splinetool/react-spline';

const SPLINE_SCENE_URL = 'https://prod.spline.design/aXWRFg2c02xm1qcU/scene.splinecode';

export default function CyberGlobe() {
  return (
    <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
      <Spline
        scene={SPLINE_SCENE_URL}
        className="h-full w-full"
      />
    </div>
  );
}
