import { useState, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { updateUserProfile, uploadAvatar } from "@/api/users";
import { getAvatarUrl } from "@/lib/utils";

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const response = await updateUserProfile({ name: name.trim() });
      updateUser(response.user);
      toast.success("Profile settings saved successfully!");
    } catch (err: any) {
      console.error("Failed to save profile:", err);
      toast.error(err.response?.data?.message || "Failed to save profile settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar size should be less than 2MB");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await uploadAvatar(formData);
      updateUser(response.user);
      toast.success("Avatar updated successfully!");
    } catch (err: any) {
      console.error("Failed to upload avatar:", err);
      toast.error(err.response?.data?.message || "Failed to upload avatar");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="bg-[#13141a] border border-white/5 text-white">
        <CardHeader>
          <CardTitle className="text-white text-base">Profile Settings</CardTitle>
          <CardDescription className="text-gray-400 text-xs">
            Update your personal details and avatar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4 py-2">
              <Avatar className="w-16 h-16 border border-white/10">
                <AvatarImage src={getAvatarUrl(user?.avatar)} />
                <AvatarFallback className="bg-indigo-600 text-white text-xl font-bold">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5 text-xs h-8 gap-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      Change Avatar
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-gray-500 mt-1">JPG, PNG or SVG. Max 2MB.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Full Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 border-white/10 text-white focus:border-indigo-500 text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Email Address</label>
              <Input
                value={email}
                disabled
                className="bg-white/5 border-white/10 text-gray-500 cursor-not-allowed text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Role</label>
              <Input
                value={user?.role === "admin" ? "Host / Administrator" : "Team Member"}
                disabled
                className="bg-white/5 border-white/10 text-gray-500 cursor-not-allowed text-xs h-9"
              />
            </div>

            <Button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white w-full md:w-auto mt-2 text-xs"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
