'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { Button } from './ui/button';

interface Props {
  interviewId: string;
}

const RetakeInterviewButton = ({ interviewId }: Props) => {
  const router = useRouter();

  const handleRetakeInterview = () => {
    router.push(`/interview/${interviewId}`);
  };
  return (
    <Button className='btn-primary flex-1' onClick={handleRetakeInterview}>
      <p className='text-sm font-semibold text-black text-center'>
        Retake Interview
      </p>
    </Button>
  );
};

export default RetakeInterviewButton;
