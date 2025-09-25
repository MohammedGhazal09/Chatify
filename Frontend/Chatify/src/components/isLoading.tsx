import LoadingSpinner from "./loadingSpinner";
import { useState, type FunctionComponent } from "react";
interface Props {
  isLoadingValue: boolean;
}

const IsLoading: FunctionComponent<Props> = ({ isLoadingValue}) => {
  const [isLoading, setIsLoading] = useState(false)
  setIsLoading(isLoadingValue)
  return (
    <>
      {isLoading && (
        <div className="flex justify-center items-center h-screen">
          <LoadingSpinner />
        </div>
      )}
    </>
  );
}

export default IsLoading;