import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps, children: ReactNode) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const IconDashboard = (props: IconProps) => base(props, <><path d="M4 13h6V4H4z" /><path d="M14 20h6V4h-6z" /><path d="M4 20h6v-3H4z" /></>);
export const IconFiles = (props: IconProps) => base(props, <><path d="M4 5h6l2 2h8v12H4z" /><path d="M4 10h16" /></>);
export const IconActions = (props: IconProps) => base(props, <><path d="M7 7h10" /><path d="M7 12h10" /><path d="M7 17h6" /><path d="M17 15l2 2-2 2" /></>);
export const IconHistory = (props: IconProps) => base(props, <><path d="M4 12a8 8 0 1 0 2.34-5.66" /><path d="M4 5v5h5" /><path d="M12 8v5l3 2" /></>);
export const IconAdvanced = (props: IconProps) => base(props, <><path d="M4 7h16" /><path d="M4 17h16" /><path d="M8 4v6" /><path d="M16 14v6" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></>);
export const IconSettings = (props: IconProps) => base(props, <><path d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z" /><path d="M12 2.8v2.1" /><path d="M12 19.1v2.1" /><path d="M4.9 4.9l1.5 1.5" /><path d="M17.6 17.6l1.5 1.5" /><path d="M2.8 12h2.1" /><path d="M19.1 12h2.1" /><path d="M4.9 19.1l1.5-1.5" /><path d="M17.6 6.4l1.5-1.5" /><path d="M8.2 3.6l.8 1.9" /><path d="M15 18.5l.8 1.9" /><path d="M3.6 15.8l1.9-.8" /><path d="M18.5 9l1.9-.8" /></>);
export const IconHeart = (props: IconProps) => base(props, <path d="M20 8.8c0 5.2-8 9.2-8 9.2s-8-4-8-9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 2.8z" />);
export const IconSparkles = (props: IconProps) => base(props, <><path d="M12 3l1.4 4.1L17 9l-3.6 1.9L12 15l-1.4-4.1L7 9l3.6-1.9z" /><path d="M19 14l.7 2 1.8 1-.8.4L19 20l-.7-2-1.8-1 1.8-1z" /></>);
export const IconClose = (props: IconProps) => base(props, <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>);
export const IconLogo = (props: IconProps) => (
  <svg viewBox="0 0 256 256" aria-hidden="true" {...props}>
    <rect width="256" height="256" rx="52" fill="#226f79" />
    <path d="M70 54h72l44 44v104H70z" fill="#f8fafc" />
    <path d="M142 54v44h44" fill="#d7edf0" />
    <path d="M86 92h42l12 14h30v32H86z" fill="#f4c95d" />
    <path d="M86 128h84v20H86z" fill="#f8fafc" opacity=".9" />
    <text
      x="128"
      y="188"
      textAnchor="middle"
      fontFamily="Inter, Arial, sans-serif"
      fontSize="58"
      fontWeight="800"
      letterSpacing="2"
      fill="#226f79"
    >
      KH
    </text>
  </svg>
);
