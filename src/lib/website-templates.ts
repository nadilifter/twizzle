export const FITNESS_TEMPLATE = `
<div class="font-sans text-slate-900">
  <!-- Navigation -->
  <nav class="bg-white shadow-sm sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <span class="font-bold text-2xl text-indigo-600">UPLIFT</span>
        </div>
        <div class="hidden md:flex items-center space-x-8">
          <a href="#" class="text-slate-600 hover:text-indigo-600 transition-colors">Classes</a>
          <a href="#" class="text-slate-600 hover:text-indigo-600 transition-colors">Trainers</a>
          <a href="#" class="text-slate-600 hover:text-indigo-600 transition-colors">Membership</a>
          <a href="#" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">Join Now</a>
        </div>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <div class="relative bg-slate-900 py-20 sm:py-32">
    <div class="absolute inset-0 overflow-hidden">
      <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop" alt="Gym Background" class="w-full h-full object-cover opacity-20">
    </div>
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
        Transform Your Body,<br/>Transform Your Life
      </h1>
      <p class="mt-6 max-w-2xl mx-auto text-xl text-slate-300">
        Join the community that pushes you further. State-of-the-art equipment, expert trainers, and a supportive atmosphere.
      </p>
      <div class="mt-10 flex justify-center gap-4">
        <a href="#" class="px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:text-lg md:px-10">
          Start Free Trial
        </a>
        <a href="#" class="px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-100 bg-white/10 hover:bg-white/20 md:text-lg md:px-10">
          View Schedule
        </a>
      </div>
    </div>
  </div>

  <!-- Features Grid -->
  <div class="py-16 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-base text-indigo-600 font-semibold tracking-wide uppercase">Why Choose Us</h2>
        <p class="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Everything you need to succeed
        </p>
      </div>

      <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Feature 1 -->
        <div class="pt-6">
          <div class="flow-root bg-slate-50 rounded-lg px-6 pb-8 shadow-sm h-full border border-slate-100 hover:border-indigo-200 transition-colors">
            <div class="-mt-6">
              <div class="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-md shadow-lg">
                <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h3 class="mt-8 text-lg font-medium text-slate-900 tracking-tight">High Energy Classes</h3>
              <p class="mt-5 text-base text-slate-500">
                From HIIT to Yoga, our classes are designed to keep you motivated and moving.
              </p>
            </div>
          </div>
        </div>

        <!-- Feature 2 -->
        <div class="pt-6">
          <div class="flow-root bg-slate-50 rounded-lg px-6 pb-8 shadow-sm h-full border border-slate-100 hover:border-indigo-200 transition-colors">
            <div class="-mt-6">
              <div class="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-md shadow-lg">
                <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              </div>
              <h3 class="mt-8 text-lg font-medium text-slate-900 tracking-tight">Expert Trainers</h3>
              <p class="mt-5 text-base text-slate-500">
                Work with certified professionals who personalize every workout to your goals.
              </p>
            </div>
          </div>
        </div>

        <!-- Feature 3 -->
        <div class="pt-6">
          <div class="flow-root bg-slate-50 rounded-lg px-6 pb-8 shadow-sm h-full border border-slate-100 hover:border-indigo-200 transition-colors">
            <div class="-mt-6">
              <div class="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-md shadow-lg">
                <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
              </div>
              <h3 class="mt-8 text-lg font-medium text-slate-900 tracking-tight">Supportive Community</h3>
              <p class="mt-5 text-base text-slate-500">
                Join a group of like-minded individuals who cheer for your every success.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Pricing Section -->
  <div class="bg-slate-50 py-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center">
        <h2 class="text-3xl font-extrabold text-slate-900 sm:text-4xl">Simple Pricing</h2>
        <p class="mt-4 text-lg text-slate-500">No hidden fees. Cancel anytime.</p>
      </div>
      <div class="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">
        
        <!-- Basic Plan -->
        <div class="border border-slate-200 rounded-lg shadow-sm bg-white divide-y divide-slate-200">
          <div class="p-6">
            <h2 class="text-lg leading-6 font-medium text-slate-900">Basic</h2>
            <p class="mt-4 text-sm text-slate-500">Perfect for getting started.</p>
            <p class="mt-8">
              <span class="text-4xl font-extrabold text-slate-900">$29</span>
              <span class="text-base font-medium text-slate-500">/mo</span>
            </p>
            <a href="#" class="mt-8 block w-full bg-indigo-50 border border-indigo-100 rounded-md py-2 text-sm font-semibold text-indigo-700 text-center hover:bg-indigo-100">Buy Basic</a>
          </div>
        </div>

        <!-- Pro Plan -->
        <div class="border border-indigo-200 rounded-lg shadow-md bg-white divide-y divide-slate-200 relative">
          <div class="absolute top-0 right-0 -mt-3 -mr-3">
             <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white">Popular</span>
          </div>
          <div class="p-6">
            <h2 class="text-lg leading-6 font-medium text-slate-900">Pro</h2>
            <p class="mt-4 text-sm text-slate-500">Everything you need to grow.</p>
            <p class="mt-8">
              <span class="text-4xl font-extrabold text-slate-900">$59</span>
              <span class="text-base font-medium text-slate-500">/mo</span>
            </p>
            <a href="#" class="mt-8 block w-full bg-indigo-600 border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center hover:bg-indigo-700">Buy Pro</a>
          </div>
        </div>

        <!-- Elite Plan -->
        <div class="border border-slate-200 rounded-lg shadow-sm bg-white divide-y divide-slate-200">
          <div class="p-6">
            <h2 class="text-lg leading-6 font-medium text-slate-900">Elite</h2>
            <p class="mt-4 text-sm text-slate-500">For the dedicated athlete.</p>
            <p class="mt-8">
              <span class="text-4xl font-extrabold text-slate-900">$99</span>
              <span class="text-base font-medium text-slate-500">/mo</span>
            </p>
            <a href="#" class="mt-8 block w-full bg-indigo-50 border border-indigo-100 rounded-md py-2 text-sm font-semibold text-indigo-700 text-center hover:bg-indigo-100">Buy Elite</a>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="bg-slate-900 text-slate-400 py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
      <div class="col-span-2 md:col-span-1">
        <span class="text-white text-xl font-bold">UPLIFT</span>
        <p class="mt-4 text-sm">Making fitness accessible and enjoyable for everyone, everywhere.</p>
      </div>
      <div>
        <h3 class="text-white text-sm font-semibold uppercase tracking-wider">Company</h3>
        <ul class="mt-4 space-y-2 text-sm">
          <li><a href="#" class="hover:text-white">About</a></li>
          <li><a href="#" class="hover:text-white">Careers</a></li>
          <li><a href="#" class="hover:text-white">Blog</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-white text-sm font-semibold uppercase tracking-wider">Support</h3>
        <ul class="mt-4 space-y-2 text-sm">
          <li><a href="#" class="hover:text-white">Help Center</a></li>
          <li><a href="#" class="hover:text-white">Contact</a></li>
          <li><a href="#" class="hover:text-white">Privacy</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-white text-sm font-semibold uppercase tracking-wider">Social</h3>
        <ul class="mt-4 space-y-2 text-sm">
          <li><a href="#" class="hover:text-white">Twitter</a></li>
          <li><a href="#" class="hover:text-white">Instagram</a></li>
          <li><a href="#" class="hover:text-white">Facebook</a></li>
        </ul>
      </div>
    </div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-center text-xs">
      &copy; 2025 Uplifter Fitness Inc. All rights reserved.
    </div>
  </footer>
</div>
`;

export const SAAS_TEMPLATE = `
<div class="font-sans text-slate-900">
  <!-- Header -->
  <header class="bg-white border-b border-slate-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2">
            <div class="h-8 w-8 bg-blue-600 rounded-lg"></div>
            <span class="font-bold text-xl text-slate-900">SaaSify</span>
        </div>
        <div class="hidden md:flex items-center gap-8">
            <a href="#" class="text-sm font-medium text-slate-600 hover:text-slate-900">Features</a>
            <a href="#" class="text-sm font-medium text-slate-600 hover:text-slate-900">Pricing</a>
            <a href="#" class="text-sm font-medium text-slate-600 hover:text-slate-900">Docs</a>
        </div>
        <div class="flex items-center gap-4">
            <a href="#" class="text-sm font-medium text-slate-600 hover:text-slate-900">Log in</a>
            <a href="#" class="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-700">Get Started</a>
        </div>
    </div>
  </header>

  <!-- Hero -->
  <div class="bg-white pt-20 pb-24 lg:pt-32 lg:pb-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight">
            Data analytics <span class="text-blue-600">simplified</span>
        </h1>
        <p class="mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto">
            Stop wrestling with complex spreadsheets. Get clear, actionable insights from your data in minutes, not days.
        </p>
        <div class="mt-10 flex justify-center gap-4">
            <a href="#" class="bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/20">Start Free Trial</a>
            <a href="#" class="text-slate-600 px-8 py-3 rounded-full text-lg font-medium hover:bg-slate-50 border border-slate-200">View Demo</a>
        </div>
        <div class="mt-16">
            <p class="text-sm font-medium text-slate-500 mb-4">TRUSTED BY TEAMS AT</p>
            <div class="flex justify-center gap-8 opacity-50 grayscale">
                <!-- Placeholders for logos -->
                <div class="h-8 w-24 bg-slate-300 rounded"></div>
                <div class="h-8 w-24 bg-slate-300 rounded"></div>
                <div class="h-8 w-24 bg-slate-300 rounded"></div>
                <div class="h-8 w-24 bg-slate-300 rounded"></div>
            </div>
        </div>
    </div>
  </div>

  <!-- Features -->
  <div class="bg-slate-50 py-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-3 gap-12">
            <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div class="h-12 w-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                </div>
                <h3 class="text-xl font-bold text-slate-900 mb-3">Real-time Tracking</h3>
                <p class="text-slate-600">Monitor your key metrics as they happen. No more waiting for daily reports.</p>
            </div>
            <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div class="h-12 w-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <h3 class="text-xl font-bold text-slate-900 mb-3">Bank-grade Security</h3>
                <p class="text-slate-600">Your data is encrypted at rest and in transit. We take security seriously.</p>
            </div>
            <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div class="h-12 w-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                </div>
                <h3 class="text-xl font-bold text-slate-900 mb-3">Team Collaboration</h3>
                <p class="text-slate-600">Invite your entire team. Share dashboards and reports with a single click.</p>
            </div>
        </div>
    </div>
  </div>
</div>
`;








