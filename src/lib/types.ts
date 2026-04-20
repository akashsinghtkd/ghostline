export type AIProvider = "openai" | "gemini";

export type ToneProfile = {
  voice: string;
  formality: "casual" | "balanced" | "formal";
  themes: string[];
  audience: string;
  industry: string;
};

export type Source = {
  id: string;
  url: string;
  title: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  fetchedAt: string;
};

export type LinkedInProfile = {
  id: string;
  url: string;
  name: string;
  headline: string;
  location?: string;
  about: string;
  experience: Array<{
    title: string;
    company: string;
    duration?: string;
    description?: string;
  }>;
  education?: Array<{ school: string; degree?: string; field?: string }>;
  skills: string[];
  activity?: string[];
  focusTags: string[];
  ideaFormats: string[];
  goals: string[];
  sources: Source[];
  tone: ToneProfile;
  createdAt: string;
  updatedAt: string;
};

export type PostIdea = {
  id: string;
  profileId: string;
  title: string;
  hook: string;
  angle: string;
  contentType: "story" | "insight" | "how-to" | "opinion" | "listicle" | "case-study";
  targetAudience: string;
  estimatedEngagement: number;
  reasoning: string;
  createdAt: string;
};

export type PostFormat = "text" | "text-with-hashtags" | "text-with-image";
export type ImageStyle = "professional" | "casual" | "minimalist" | "infographic";

export type GeneratedPost = {
  id: string;
  profileId: string;
  ideaId: string;
  idea: PostIdea;
  format: PostFormat;
  content: string;
  hashtags: string[];
  imagePrompt?: string;
  imageUrl?: string;
  imageStyle?: ImageStyle;
  provider: AIProvider;
  createdAt: string;
};
