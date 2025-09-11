import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Image, Send, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Globe, Lock, CalendarClock, MapPin, Smile, Type, Video, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "convex/react";
import { useRef, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function readFileAsArrayBuffer(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

type UploadState = {
  file: File;
  progress: number; // 0 - 100
  status: "idle" | "uploading" | "done" | "error" | "canceled";
  xhr?: XMLHttpRequest;
  storageId?: Id<"_storage">;
  error?: string;
};

export function CreatePost() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPost = useMutation(api.posts.createPost);
  const [files, setFiles] = useState<File[]>([]);
  const [imageIds, setImageIds] = useState<Array<Id<"_storage">>>([]);
  const [videoIds, setVideoIds] = useState<Array<Id<"_storage">>>([]);
  const generateUploadUrl = useAction(api.files.generateUploadUrl);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [audience, setAudience] = useState<"public" | "friends" | "private">("public");
  const friends = useQuery(api.friends.getUserFriends, {});
  const [tagged, setTagged] = useState<Array<{ _id: Id<"users">; name?: string; image?: string }>>([]);
  const [location, setLocation] = useState("");
  const [feeling, setFeeling] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>(""); // datetime-local string
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isChecking, setIsChecking] = useState(false); // disable post while background checks (validation / uploads)
  const [hadUploading, setHadUploading] = useState(false);

  const feelings: Array<string> = [
    "Happy",
    "Excited", 
    "Blessed",
    "Grateful",
    "Loved",
    "Tired",
    "Productive",
    "Chilling",
    "Celebrating",
    "Traveling",
  ];

  useEffect(() => {
    const currentlyUploading = uploads.some((u) => u.status === "uploading");
    if (currentlyUploading && !hadUploading) {
      setHadUploading(true);
    }
    if (!currentlyUploading && hadUploading) {
      toast.success("All media uploaded. You can post now.");
      setHadUploading(false);
    }
  }, [uploads, hadUploading]);

  useEffect(() => {
    // If any upload shows 100% but still marked as "uploading", mark it "done"
    let changed = false;
    const next: UploadState[] = uploads.map((u) => {
      if (u.status === "uploading" && u.progress >= 100) {
        changed = true;
        return { ...u, status: "done" as const };
      }
      return u;
    });
    if (changed) {
      setUploads(next);
    }
  }, [uploads]);

  useEffect(() => {
    // Abort any in-flight XHRs when component unmounts or dependencies change
    return () => {
      try {
        uploads.forEach((u) => {
          if (u.status === "uploading") {
            u.xhr?.abort();
          }
        });
      } catch {
        // ignore
      }
    };
  }, [uploads]);

  const clearCompletedUploadByStorageId = (storageId: Id<"_storage">) => {
    setUploads((prev) => {
      const idx = prev.findIndex((u) => u.storageId === storageId);
      if (idx === -1) return prev;
      setFiles((filesPrev) => filesPrev.filter((_, i) => i !== idx));
      return prev.filter((_, i) => i !== idx);
    });
  };

  const clearAllUploads = () => {
    setFiles([]);
    setUploads([]);
    setImageIds([]);
    setVideoIds([]);
  };

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
  const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB
  const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const ACCEPTED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];

  const validateFile = (file: File): string | null => {
    if (file.type.startsWith("image/")) {
      if (!ACCEPTED_IMAGE.includes(file.type)) return "Unsupported image format";
      if (file.size > MAX_IMAGE_BYTES) return "Image exceeds 10MB limit";
    } else if (file.type.startsWith("video/")) {
      if (!ACCEPTED_VIDEO.includes(file.type)) return "Unsupported video format";
      if (file.size > MAX_VIDEO_BYTES) return "Video exceeds 500MB limit";
    } else {
      return "Only images and videos are allowed";
    }
    return null;
  };

  const startUpload = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    const upload: UploadState = { file, progress: 0, status: "uploading" };
    setUploads((prev) => [...prev, upload]);

    try {
      const uploadUrl = await generateUploadUrl({});
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        upload.xhr = xhr;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) =>
              prev.map((u) => (u === upload ? { ...u, progress: pct } : u))
            );
          }
        };

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText);
              const storageId: Id<"_storage"> = json.storageId;
              setUploads((prev) =>
                prev.map((u) => (u === upload ? { ...u, progress: 100, status: "done", storageId } : u))
              );
              if (file.type.startsWith("image/")) {
                setImageIds((prev) => [...prev, storageId]);
              } else if (file.type.startsWith("video/")) {
                setVideoIds((prev) => [...prev, storageId]);
              }
              resolve();
            } catch (err) {
              reject(new Error("Invalid upload response"));
            }
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload canceled"));

        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });
    } catch (e: any) {
      setUploads((prev) =>
        prev.map((u) => (u === upload ? { ...u, status: "error", error: e?.message || "Upload failed" } : u))
      );
      toast.error(e?.message || "Failed to upload");
    }
  };

  const cancelUpload = (index: number) => {
    const u = uploads[index];
    if (!u) return;

    if (u.status === "uploading") {
      try {
        u?.xhr?.abort();
      } catch {}
      setUploads((prev) =>
        prev.map((uu, i) => (i === index ? { ...uu, status: "canceled", error: "Canceled" } : uu))
      );
      setFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      if (u.storageId) {
        setImageIds((ids) => ids.filter((id) => (id as unknown as string) !== (u.storageId as unknown as string)));
        setVideoIds((ids) => ids.filter((id) => (id as unknown as string) !== (u.storageId as unknown as string)));
      }
      setUploads((prev) => prev.filter((_, i) => i !== index));
      setFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const submitNow = async (asDraft: boolean) => {
    if (
      !content.trim() &&
      imageIds.length === 0 &&
      videoIds.length === 0
    ) return;
    if (uploads.some((u) => u.status === "uploading")) return;

    setIsSubmitting(true);
    try {
      const scheduledNumber = scheduleEnabled && scheduledAt ? new Date(scheduledAt).getTime() : undefined;
      await createPost({
        content: content.trim(),
        isPublic: audience === "public",
        audience,
        images: imageIds,
        videos: videoIds,
        tags: tagged.map((t) => t._id),
        scheduledAt: scheduledNumber,
        isDraft: asDraft,
        location: location.trim() || undefined,
        feeling: feeling.trim() || undefined,
      });

      setContent("");
      setFiles([]);
      setImageIds([]);
      setVideoIds([]);
      setUploads([]);
      setTagged([]);
      setScheduleEnabled(false);
      setScheduledAt("");
      setLocation("");
      setFeeling("");
      toast.success(asDraft ? "Draft saved" : "Post created successfully!");
    } catch (error) {
      toast.error(asDraft ? "Failed to save draft" : "Failed to create post");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilesPicked = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const selected = Array.from(picked);
    setFiles((prev) => [...prev, ...selected]);
    setIsChecking(true);
    for (const file of selected) {
      await startUpload(file);
    }
    setIsChecking(false);
    toast.success("Files queued for upload");
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    if (dt?.files && dt.files.length > 0) {
      await handleFilesPicked(dt.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitNow(false); // Use programmatic submit
  };

  const handleSaveDraft = async () => {
    if (!content.trim() && imageIds.length === 0 && videoIds.length === 0) {
      toast.error("Draft must have some content or media");
      return;
    }
    if (uploads.some((u) => u.status === "uploading")) {
      return;
    }
    setIsSubmitting(true);
    try {
      const scheduledNumber = scheduleEnabled && scheduledAt ? new Date(scheduledAt).getTime() : undefined;

      await createPost({
        content: content.trim(),
        isPublic: audience === "public",
        audience,
        images: imageIds,
        videos: videoIds,
        tags: tagged.map((t) => t._id),
        scheduledAt: scheduledNumber,
        isDraft: true,
      });

      toast.success("Draft saved");
    } catch (e) {
      toast.error("Failed to save draft");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (u: any) => {
    const id = u?._id;
    if (!id) return;
    setTagged((prev) => {
      const exists = prev.find((p) => (p._id as unknown as string) === (id as unknown as string));
      if (exists) return prev.filter((p) => (p._id as unknown as string) !== (id as unknown as string));
      return [...prev, { _id: id, name: u?.name, image: u?.image }];
    });
  };

  const onPickFiles = async (picked: FileList | null) => {
    await handleFilesPicked(picked);
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mb-6"
    >
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onPickFiles(e.target.files)}
        id="create-post-file-input-images"
      />
      <input
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => onPickFiles(e.target.files)}
        id="create-post-file-input-videos"
      />
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <Avatar>
                <AvatarImage src={user?.image} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
                    <SelectTrigger className="h-8 w-[150px]">
                      <SelectValue placeholder="Audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" /> Public
                        </div>
                      </SelectItem>
                      <SelectItem value="friends">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" /> Friends
                        </div>
                      </SelectItem>
                      <SelectItem value="private">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" /> Only Me
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Add location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="h-8 pl-7 w-[180px]"
                      />
                    </div>
                    <div className="relative">
                      <Smile className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Feeling/activity"
                        value={feeling}
                        onChange={(e) => setFeeling(e.target.value)}
                        className="h-8 pl-7 w-[180px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md border ${scheduleEnabled ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground"}`}
                      onClick={() => setScheduleEnabled((s) => !s)}
                      title="Schedule post"
                    >
                      <CalendarClock className="h-4 w-4" />
                      Schedule
                    </button>
                    {scheduleEnabled && (
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="h-8 w-[220px]"
                      />
                    )}
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        Tag friends
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0">
                      <div className="p-2 border-b font-medium text-sm">Tag people</div>
                      <ScrollArea className="h-56">
                        <div className="p-2 space-y-1">
                          {Array.isArray(friends) && friends.length > 0 ? (
                            friends.map((f: any) => {
                              const id = f._id;
                              const active = tagged.find((t) => (t._id as unknown as string) === (id as unknown as string));
                              return (
                                <button
                                  key={(id as unknown as string)}
                                  type="button"
                                  onClick={() => toggleTag(f)}
                                  className={`w-full flex items-center gap-2 rounded-md p-2 text-left hover:bg-muted ${active ? "bg-muted" : ""}`}
                                >
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={f.image} />
                                    <AvatarFallback className="bg-muted text-xs">
                                      {f.name?.charAt(0) || "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="truncate text-sm">{f.name || "Anonymous"}</div>
                                  </div>
                                  {active && <span className="text-xs text-primary">Tagged</span>}
                                </button>
                              );
                            })
                          ) : (
                            <div className="p-3 text-xs text-muted-foreground">No friends to tag.</div>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  {tagged.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tagged.map((t) => (
                        <span key={(t._id as unknown as string)} className="inline-flex items-center gap-1 bg-muted text-xs rounded-full px-2 py-1">
                          {t.name || "User"}
                          <button type="button" onClick={() => toggleTag({ _id: t._id })} aria-label="Remove tag">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Textarea
                  ref={textareaRef}
                  placeholder="Share your thoughts…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[100px] resize-none border-0 p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0"
                />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Text (focus composer) */}
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#1877F2]"
                    onClick={() => textareaRef.current?.focus()}
                    title="Write text"
                  >
                    <Type className="w-4 h-4 mr-2" />
                    Text
                  </Button>

                  {/* Photo */}
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#1877F2]"
                    onClick={() => {
                      const el = document.getElementById("create-post-file-input-images");
                      (el as HTMLInputElement)?.click();
                    }}
                    title="Add photos"
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Photo
                  </Button>

                  {/* Video */}
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#1877F2]"
                    onClick={() => {
                      const el = document.getElementById("create-post-file-input-videos");
                      (el as HTMLInputElement)?.click();
                    }}
                    title="Add videos"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Video
                  </Button>

                  {/* Tag friends */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#1877F2]"
                        title="Tag friends"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Tag
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0">
                      <div className="p-2 border-b font-medium text-sm">Tag people</div>
                      <ScrollArea className="h-56">
                        <div className="p-2 space-y-1">
                          {Array.isArray(friends) && friends.length > 0 ? (
                            friends.map((f: any) => {
                              const id = f._id;
                              const active = tagged.find(
                                (t) => (t._id as unknown as string) === (id as unknown as string)
                              );
                              return (
                                <button
                                  key={(id as unknown as string)}
                                  type="button"
                                  onClick={() => toggleTag(f)}
                                  className={`w-full flex items-center gap-2 rounded-md p-2 text-left hover:bg-muted ${
                                    active ? "bg-muted" : ""
                                  }`}
                                >
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={f.image} />
                                    <AvatarFallback className="bg-muted text-xs">
                                      {f.name?.charAt(0) || "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="truncate text-sm">{f.name || "Anonymous"}</div>
                                  </div>
                                  {active && <span className="text-xs text-primary">Tagged</span>}
                                </button>
                              );
                            })
                          ) : (
                            <div className="p-3 text-xs text-muted-foreground">No friends to tag.</div>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  {/* Feeling / Activity */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#1877F2]"
                        title="Feeling / Activity"
                      >
                        <Smile className="w-4 h-4 mr-2" />
                        Feeling/Activity
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-2">
                      <div className="text-sm font-medium px-1 pb-2">What are you up to?</div>
                      <div className="grid grid-cols-2 gap-1">
                        {feelings.map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={`text-left text-sm px-2 py-1 rounded-md hover:bg-muted ${
                              feeling === f ? "bg-muted" : ""
                            }`}
                            onClick={() => setFeeling(f)}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                      {feeling && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Selected: {feeling}</span>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setFeeling("")}>
                            Clear
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  {/* Location */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#1877F2]"
                        title="Add location"
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Location
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72">
                      <div className="text-sm font-medium mb-2">Add a place</div>
                      <Input
                        placeholder="Where are you?"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {location && (
                          <Button variant="ghost" size="sm" onClick={() => setLocation("")}>
                            Clear
                          </Button>
                        )}
                        <Button size="sm" onClick={() => { /* Close via outside click; value already set */ }}>
                          Save
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Optional: Privacy dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#1877F2]"
                        title="Privacy"
                      >
                        {audience === "public" ? (
                          <Globe className="w-4 h-4 mr-2" />
                        ) : audience === "friends" ? (
                          <Users className="w-4 h-4 mr-2" />
                        ) : (
                          <Lock className="w-4 h-4 mr-2" />
                        )}
                        {audience === "public" ? "Public" : audience === "friends" ? "Friends" : "Only Me"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuItem onClick={() => setAudience("public" as any)}>
                        <Globe className="w-4 h-4 mr-2" /> Public
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAudience("friends" as any)}>
                        <Users className="w-4 h-4 mr-2" /> Friends
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAudience("private" as any)}>
                        <Lock className="w-4 h-4 mr-2" /> Only Me
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Small inline preview for feeling/location */}
                {(feeling || location) && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {feeling ? `Feeling ${feeling}` : ""}{feeling && location ? " · " : ""}{location ? `At ${location}` : ""}
                  </div>
                )}

                {(uploads.length > 0 || files.length > 0) && (
                  <div className="mt-3">
                    {uploads.length > 1 ? (
                      <Carousel className="w-full">
                        <CarouselContent>
                          {uploads.map((u, i) => {
                            const isVideo = u.file.type.startsWith("video/");
                            const url = URL.createObjectURL(u.file);
                            return (
                              <CarouselItem key={i} className="basis-full">
                                <div className="relative rounded-lg overflow-hidden border">
                                  {isVideo ? (
                                    <video
                                      src={url}
                                      muted
                                      loop
                                      autoPlay
                                      className="w-full max-h-72 object-contain bg-black"
                                    />
                                  ) : (
                                    <img
                                      src={url}
                                      alt="preview"
                                      className="w-full max-h-72 object-contain bg-black/5"
                                    />
                                  )}
                                  {u.status !== "done" && (
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                      <div className="text-white text-sm">
                                        {u.status === "uploading"
                                          ? `Uploading… ${u.progress}%`
                                          : u.status === "error"
                                          ? u.error || "Upload error"
                                          : u.status === "canceled"
                                          ? "Canceled"
                                          : "Queued"}
                                      </div>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => cancelUpload(i)}
                                    className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-1 text-xs shadow hover:bg-white"
                                    aria-label="Remove media"
                                    title={u.status === "uploading" ? "Cancel upload" : "Remove"}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </CarouselItem>
                            );
                          })}
                        </CarouselContent>
                      </Carousel>
                    ) : (
                      uploads.map((u, i) => {
                        const isVideo = u.file.type.startsWith("video/");
                        const url = URL.createObjectURL(u.file);
                        return (
                          <div key={i} className="relative mt-2 rounded-lg overflow-hidden border">
                            {isVideo ? (
                              <video
                                src={url}
                                muted
                                loop
                                autoPlay
                                className="w-full max-h-72 object-contain bg-black"
                              />
                            ) : (
                              <img
                                src={url}
                                alt="preview"
                                className="w-full max-h-72 object-contain bg-black/5"
                              />
                            )}
                            {u.status !== "done" && (
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="text-white text-sm">
                                  {u.status === "uploading"
                                    ? `Uploading… ${u.progress}%`
                                    : u.status === "error"
                                    ? u.error || "Upload error"
                                    : u.status === "canceled"
                                    ? "Canceled"
                                    : "Queued"}
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => cancelUpload(i)}
                              className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-1 text-xs shadow hover:bg-white"
                              aria-label="Remove media"
                              title={u.status === "uploading" ? "Cancel upload" : "Remove"}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={handleDrop}
                  className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                >
                  Drag & drop photos/videos here, or
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-primary ml-1"
                    onClick={() => {
                      const el = document.getElementById("create-post-file-input-images");
                      (el as HTMLInputElement)?.click();
                    }}
                  >
                    browse
                  </Button>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    {/* New: One button to add photo/video */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const el = document.getElementById("create-post-file-input-images");
                        (el as HTMLInputElement)?.click();
                      }}
                      title="Add photo or video"
                      className="gap-2"
                    >
                      <Image className="w-4 h-4" />
                      Add Media
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting || isChecking}
                      onClick={handleSaveDraft}
                    >
                      Save Draft
                    </Button>
                    {(() => {
                      const hasContentOrMedia =
                        !!content.trim() || imageIds.length > 0 || videoIds.length > 0;
                      const hasUploading = uploads.some((u) => u.status === "uploading");
                      const canPost =
                        hasContentOrMedia && !isSubmitting && !isChecking && !hasUploading;

                      return (
                        <Button
                          type="submit"
                          disabled={!canPost}
                          title={
                            !hasContentOrMedia
                              ? "Add text or media to post"
                              : hasUploading || isChecking
                              ? "Please wait for uploads to finish"
                              : isSubmitting
                              ? "Posting…"
                              : undefined
                          }
                          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-full"
                        >
                          {isSubmitting ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-1" />
                              Post
                            </>
                          )}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}