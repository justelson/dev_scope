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

const getLogoBackdropStyle = (themeColor?: string) => {
    if (!themeColor || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(themeColor)) {
        return { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: 'rgba(255, 255, 255, 0.18)' };
    }

    const hex = themeColor.replace('#', '');
    const normalized = hex.length === 3
        ? hex.split('').map(ch => ch + ch).join('')
        : hex;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    if (luminance < 0.55) {
        return { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'rgba(255, 255, 255, 0.3)' };
    }
    return { backgroundColor: 'rgba(0, 0, 0, 0.35)', borderColor: 'rgba(0, 0, 0, 0.45)' };
};

export default function ToolIcon({ tool, size = 24, className, ...props }: ToolIconProps) {
    const [logoError, setLogoError] = useState(false);
    const [iconError, setIconError] = useState(false);
    const toolData = getToolById(tool);
    const logoUrl = toolData?.logoUrl;
    const iconSlug = toolData?.icon;
    const themeColor = toolData?.themeColor;
    const isAiAgent = toolData?.category === 'ai_agent';

    // Prefer explicit logo URLs if provided
    if (logoUrl && !logoError) {
        const backdrop = getLogoBackdropStyle(themeColor);
        return (
            <div
                className={`relative flex items-center justify-center ${className}`}
                style={{ width: size, height: size }}
                {...props}
            >
                <img
                    src={logoUrl}
                    alt={`${tool} logo`}
                    width={size}
                    height={size}
                    className="w-full h-full object-contain rounded-md"
                    style={{
                        backgroundColor: backdrop.backgroundColor,
                        border: `1px solid ${backdrop.borderColor}`,
                        padding: Math.max(2, Math.floor(size * 0.12)),
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))'
                    }}
                    onError={() => setLogoError(true)}
                    loading="lazy"
                />
            </div>
        );
    }

    // If we have an icon slug from registry and no error, use Simple Icons CDN
    if (!isAiAgent && iconSlug && !iconError) {
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
                    onError={() => setIconError(true)}
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

