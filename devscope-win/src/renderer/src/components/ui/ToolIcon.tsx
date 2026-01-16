import { ComponentProps, useState } from 'react';
import {
    Box, Code, Terminal, Cpu, Layers,
    Sparkles, Bot, Brain, Package, Boxes, GitBranch
} from 'lucide-react';
import { getToolById } from '../../../../shared/tool-registry';

interface ToolIconProps extends ComponentProps<'div'> {
    tool: string;
    size?: number;
    className?: string;
}

// Fallback Lucide icons by category
const CATEGORY_ICONS: Record<string, any> = {
    'language': Code,
    'package_manager': Package,
    'build_tool': Layers,
    'container': Boxes,
    'version_control': GitBranch,
    'ai_runtime': Brain,
    'ai_agent': Sparkles,
    'default': Terminal,
};

export default function ToolIcon({ tool, size = 24, className, ...props }: ToolIconProps) {
    const [imgError, setImgError] = useState(false);
    const toolData = getToolById(tool);
    const iconSlug = toolData?.icon;
    const themeColor = toolData?.themeColor;

    // If we have an icon slug from registry and no error, use Simple Icons CDN
    if (iconSlug && !imgError) {
        const iconUrl = `https://cdn.simpleicons.org/${iconSlug}/white`;

        return (
            <div
                className={`relative flex items-center justify-center ${className}`}
                style={{ width: size, height: size }}
                {...props}
            >
                <img
                    src={iconUrl}
                    alt={`${tool} logo`}
                    width={size}
                    height={size}
                    className="w-full h-full object-contain"
                    style={{ filter: themeColor ? `drop-shadow(0 0 1px ${themeColor})` : undefined }}
                    onError={() => setImgError(true)}
                    loading="lazy"
                />
            </div>
        );
    }

    // Fallback to Lucide icon based on category
    const category = toolData?.category || 'default';
    const FallbackIcon = CATEGORY_ICONS[category] || CATEGORY_ICONS['default'];
    const fallbackColor = themeColor || '#a1a1aa';

    return (
        <div
            className={`flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
            {...props}
        >
            <FallbackIcon size={size * 0.75} style={{ color: fallbackColor }} />
        </div>
    );
}
