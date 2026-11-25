import ProfileClient from "./ProfileClient";

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return (
    <div className="pb-20 min-h-dvh bg-white">
      <ProfileClient />
    </div>
  );
}
