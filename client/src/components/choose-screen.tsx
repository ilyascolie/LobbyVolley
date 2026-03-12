import { Mail, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ChooseScreenProps {
  onStart: () => void;
}

export default function ChooseScreen({ onStart }: ChooseScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-10 animate-fadeIn">
      <div className="w-full max-w-[700px] text-center">
        <h1 className="font-serif text-4xl tracking-tight mb-3">
          The fastest way to lobby your representatives.
        </h1>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-10">
          Enter your ZIP code, describe your cause, and we'll send a volley of letters to your reps.
        </p>

        <button
          className="w-full text-left p-7 bg-white border-2 border-border rounded-2xl cursor-pointer transition-all duration-200 hover:border-foreground hover:shadow-lg group relative"
          onClick={onStart}
        >
          <div className="text-2xl mb-3">
            <Mail className="w-7 h-7" />
          </div>
          <div className="text-xl font-bold mb-1">Send a New Volley</div>
          <div className="text-sm text-gray-500 leading-relaxed mb-5">
            Enter your ZIP code, describe your cause, and send a mail blast to all your representatives offices.
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px] font-semibold">ZIP Lookup</Badge>
            <Badge variant="secondary" className="text-[10px] font-semibold">Federal + State</Badge>
            <Badge className="text-[10px] font-semibold bg-blue-100 text-blue-600 hover:bg-blue-100">AI-Powered</Badge>
          </div>
          <ChevronRight className="absolute top-7 right-7 w-5 h-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
