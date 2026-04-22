'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

export default function AppProgressBar() {
    return (
        <ProgressBar
            height="4px"
            color="#E30613"
            options={{ showSpinner: false }}
            shallowRouting
        />
    );
}
