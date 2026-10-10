import { ModelStatus } from '../components/ModelStatus';

export function AboutScreen() {
  return (
    <div className="grid max-w-2xl gap-8">
      <h1 className="text-4xl font-extrabold tracking-tight">About</h1>
      <div className="grid gap-4 text-lg leading-relaxed">
        <p>
          Side Quest hands you a tiny outdoor mission. Go find it, take a photo, and Gemma decides whether you found
          it. If you did, a creature inspired by your photo hatches into your collection.
        </p>
        <p>
          Gemma, Google's open-weight model, runs right here in your browser on your own GPU. Playing solo, your photos
          never leave this device. If you sign in to play on your phone, photos travel through Side Quest's server to
          your computer and stay there until you delete your account. No location tracking.
        </p>
      </div>
      <ModelStatus className="justify-self-start" />
      <p className="text-sm text-fog">
        Made with 💖 by{' '}
        <a href="https://pinkpixel.dev" className="rounded underline decoration-ink-3 underline-offset-4 hover:text-snow">
          Pink Pixel
        </a>
      </p>
    </div>
  );
}
