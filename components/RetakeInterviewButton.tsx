'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { Button } from './ui/button';
import { retakeInterview } from '@/lib/actions/general.action';

interface Props {
  interviewId: string;
  userId: string;
}

const RetakeInterviewButton = ({ interviewId, userId }: Props) => {
  const router = useRouter();

  const handleRetakeInterview = async () => {
    try {
      const interviewInstance = await retakeInterview({ interviewId, userId });

      if (interviewInstance?.id) {
        router.push(`/interview/${interviewInstance.id}`);
      }
    } catch (error) {
      console.error('error in retake interview button', error);
    }
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
