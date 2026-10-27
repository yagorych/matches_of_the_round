import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

type Props = {
  /** Момент последней успешной загрузки. */
  since: Date;
};

export function UpdatedAgo({ since }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const updatedAt = since.getTime();

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [updatedAt]);

  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  return <Text style={styles.text}>Обновлено {seconds} сек назад</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 13, color: '#667085' },
});
