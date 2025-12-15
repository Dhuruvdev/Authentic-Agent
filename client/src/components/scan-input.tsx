import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, User, Image, Search, Loader2 } from "lucide-react";
import type { InputType } from "@shared/schema";

interface ScanInputProps {
  onScan: (input: string) => void;
  isScanning: boolean;
}

export function ScanInput({ onScan, isScanning }: ScanInputProps) {
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState<InputType>("email");

  const detectInputType = (value: string): InputType => {
    if (!value) return "email";
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(value)) return "email";
    
    const urlRegex = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
    if (urlRegex.test(value)) return "image_url";
    
    const imageUrlLoose = /^https?:\/\/.+/i;
    if (imageUrlLoose.test(value) && (value.includes("image") || value.includes("photo") || value.includes("avatar"))) {
      return "image_url";
    }
    
    return "username";
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    setInputType(detectInputType(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isScanning) {
      onScan(input.trim());
    }
  };

  const getPlaceholder = () => {
    switch (inputType) {
      case "email":
        return "Enter an email address...";
      case "username":
        return "Enter a username...";
      case "image_url":
        return "Enter an image URL...";
      default:
        return "Enter email, username, or image URL...";
    }
  };

  const getInputIcon = () => {
    switch (inputType) {
      case "email":
        return <Mail className="w-5 h-5" />;
      case "username":
        return <User className="w-5 h-5" />;
      case "image_url":
        return <Image className="w-5 h-5" />;
      default:
        return <Search className="w-5 h-5" />;
    }
  };

  const inputTypes: { type: InputType; label: string; icon: typeof Mail }[] = [
    { type: "email", label: "Email", icon: Mail },
    { type: "username", label: "Username", icon: User },
    { type: "image_url", label: "Image URL", icon: Image },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {inputTypes.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            variant={inputType === type ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setInputType(type)}
            className="gap-2"
            data-testid={`button-type-${type}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {getInputIcon()}
          </div>
          <Input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={getPlaceholder()}
            className="h-14 pl-12 pr-4 text-lg"
            disabled={isScanning}
            data-testid="input-scan"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-12"
          disabled={!input.trim() || isScanning}
          data-testid="button-scan"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="w-5 h-5 mr-2" />
              Analyze Exposure
            </>
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center">
        We only check publicly accessible information. Your input is not stored.
      </p>
    </div>
  );
}
