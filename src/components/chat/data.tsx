export const userData = [
  {
    id: 1,
    avatar: "/avatars/01.png",
    messages: [
      {
        id: 1,
        avatar: "/avatars/01.png",
        name: "Jakob Hoeg",
        message: "Hey, do you have a minute to talk?",
        timestamp: "10:00 AM",
      },
      {
        id: 2,
        avatar: "/avatars/05.png",
        name: "You",
        message: "Hi Jakob! Sure, what's up?",
        timestamp: "10:01 AM",
      },
      {
        id: 3,
        avatar: "/avatars/01.png",
        name: "Jakob Hoeg",
        message: "I was wondering if I could go to the movies with my friends this Friday?",
        timestamp: "10:02 AM",
      },
      {
        id: 4,
        avatar: "/avatars/05.png",
        name: "You",
        message: "Which movie are you planning to see?",
        timestamp: "10:03 AM",
      },
      {
        id: 5,
        avatar: "/avatars/01.png",
        name: "Jakob Hoeg",
        message: "The new Marvel movie. It starts at 7 PM.",
        timestamp: "10:04 AM",
      },
      {
        id: 6,
        avatar: "/avatars/05.png",
        name: "You",
        message: "Okay, that sounds fine. Who are you going with?",
        timestamp: "10:05 AM",
      },
      {
        id: 7,
        avatar: "/avatars/01.png",
        name: "Jakob Hoeg",
        message: "Just Sam and Alex from school.",
        timestamp: "10:05 AM",
      },
      {
        id: 8,
        avatar: "/avatars/05.png",
        name: "You",
        message: "Alright. Make sure you're home by 10 PM.",
        timestamp: "10:06 AM",
      },
      {
        id: 9,
        avatar: "/avatars/01.png",
        name: "Jakob Hoeg",
        message: "Thanks! I will.",
        timestamp: "10:06 AM",
      },
    ],
    name: "Jakob Hoeg",
    isMinor: true,
  },
  {
    id: 2,
    avatar: "/avatars/02.png",
    name: "Jackson Lee",
    messages: [
      {
        id: 1,
        avatar: "/avatars/02.png",
        name: "Jackson Lee",
        message: "Hey, are we still on for the meeting tomorrow?",
        timestamp: "Yesterday",
      },
      {
        id: 2,
        avatar: "/avatars/05.png",
        name: "You",
        message: "Yes, 2 PM right?",
        timestamp: "Yesterday",
      },
      {
        id: 3,
        avatar: "/avatars/02.png",
        name: "Jackson Lee",
        message: "Perfect. I'll bring the project files.",
        timestamp: "Yesterday",
      },
      {
        id: 4,
        avatar: "/avatars/05.png",
        name: "You",
        message: "Great, see you then.",
        timestamp: "Yesterday",
      },
    ],
    isMinor: false,
  },
  {
    id: 3,
    avatar: "/avatars/03.png",
    name: "Isabella Nguyen",
    messages: [
      {
        id: 1,
        avatar: "/avatars/03.png",
        name: "Isabella Nguyen",
        message: "Hi! I finished my history homework.",
        timestamp: "2 days ago",
      },
      {
        id: 2,
        avatar: "/avatars/05.png",
        name: "You",
        message: "Good job! Did you double check your sources?",
        timestamp: "2 days ago",
      },
      {
        id: 3,
        avatar: "/avatars/03.png",
        name: "Isabella Nguyen",
        message: "Yes, I used the <a href='https://library.com' target='_blank' class='text-blue-500 underline'>library website</a> like you said.",
        timestamp: "2 days ago",
      },
    ],
    isMinor: true,
  },
  {
    id: 4,
    avatar: "/avatars/04.png",
    name: "William Kim",
    messages: [
      {
        id: 1,
        avatar: "/avatars/04.png",
        name: "William Kim",
        message: "<p>Running late for the gym, <b>start without me</b>.</p>",
        timestamp: "1 week ago",
      },
      {
        id: 2,
        avatar: "/avatars/05.png",
        name: "You",
        message: "No worries, I'm just warming up.",
        timestamp: "1 week ago",
      },
      {
        id: 3,
        avatar: "/avatars/04.png",
        name: "William Kim",
        message: "Cool, be there in 10.",
        timestamp: "1 week ago",
      },
    ],
    isMinor: false,
  },
];

export type UserData = (typeof userData)[number];

export const loggedInUserData = {
  id: 5,
  avatar: "/avatars/05.png",
  name: "You",
};

export type LoggedInUserData = typeof loggedInUserData;

export interface Message {
  id: number;
  avatar: string;
  name: string;
  message: string;
  timestamp?: string;
  role?: string;
}

export interface User {
  id: number;
  avatar: string;
  messages: Message[];
  name: string;
  isMinor?: boolean;
}
